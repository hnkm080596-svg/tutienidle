<script setup lang="ts">
// UI redesign — Động Phủ home world background (bản thiết kế mục 2,8):
// nhân vật ngồi xếp bằng tại Linh Nhãn, vòng trận pháp nhẹ dưới chân,
// linh khí bay chậm quanh — thay nền phẳng #0b0b10 cũ của MainScene.vue.
//
// Trigger command wheel (2026-08-26, dong-fu-command-wheel plan
// Workstream A/B) — .home-player giờ là NÚT BẮM render PlayerPortrait
// (PNG tĩnh player-mortal-cultivate-v1 + chuyển động CSS), là trigger
// DUY NHẤT mở command wheel nhiều tầng. Không còn atlas idle/cultivate
// qua AtlasSprite ở đây nữa.
//
// Background 2D parallax (2026-08-30): ten aligned textures compose depth
// from far to near. The straight ground is reserved for separate 2D buildings,
// while season and time reuse the shared ThanhVanVariant selected by combat.
// DOM remains the sole background renderer to avoid competing pipelines.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useStageActive } from '@/composables/useStageActive'
import {
  dongFuLayerList,
  type DongFuLayerDescriptor,
} from '@/game/support/DongFuArt'
import { preloadDongFuStack } from '@/game/support/DongFuStackLoader'
import {
  peekThanhVanVariant,
  type ThanhVanVariant,
} from '@/game/support/ThanhVanArt'
import { useUiStore } from '@/stores/ui'
import HomeBuildingIcons from './HomeBuildingIcons.vue'
import PlayerPortrait from '../common/PlayerPortrait.vue'

interface DongFuRenderStack {
  variant: ThanhVanVariant
  layers: readonly DongFuLayerDescriptor[]
}

function createRenderStack(variant: ThanhVanVariant): DongFuRenderStack {
  return {
    variant,
    layers: dongFuLayerList(variant),
  }
}

const pointerPosition = ref({ x: 0, y: 0 })
const reducedMotion = ref(false)
const activeStack = ref<DongFuRenderStack>(createRenderStack(peekThanhVanVariant()))
const previousStack = ref<DongFuRenderStack | null>(null)
const transitionActive = ref(false)
const stageActive = useStageActive()
const ui = useUiStore()

let reducedMotionQuery: MediaQueryList | undefined
let transitionTimer: ReturnType<typeof setTimeout> | undefined
let refreshGeneration = 0

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

function variantsMatch(left: ThanhVanVariant, right: ThanhVanVariant): boolean {
  return left.season === right.season && left.time === right.time
}

function parallaxStyle(layer: DongFuLayerDescriptor) {
  const x = reducedMotion.value ? 0 : -pointerPosition.value.x * layer.shiftX
  const y = reducedMotion.value ? 0 : -pointerPosition.value.y * layer.shiftY

  return {
    '--parallax-x': `${x}px`,
    '--parallax-y': `${y}px`,
  }
}

// Building hotspot layer "gắn" vào đúng mặt đất nó đứng trên (bug report
// 2026-08-30: building không ăn parallax nên trôi so với mặt đất khi mặt
// đất dịch theo chuột) — dùng LẠI đúng shiftX/shiftY của lớp
// '07-sect-ground', building sẽ dịch CÙNG PHA với mặt đất, chỉ lệch so
// với các lớp xa hơn (mây/núi) để vẫn giữ cảm giác chiều sâu.
const buildingParallaxStyle = computed(() => {
  const groundLayer = activeStack.value.layers.find((layer) => layer.name === '07-sect-ground')

  return groundLayer ? parallaxStyle(groundLayer) : {}
})

function handlePointerMove(event: PointerEvent): void {
  if (reducedMotion.value) {
    pointerPosition.value = { x: 0, y: 0 }
    return
  }

  pointerPosition.value = {
    x: clampUnit((event.clientX / window.innerWidth - 0.5) * 2),
    y: clampUnit((event.clientY / window.innerHeight - 0.5) * 2),
  }
}

function handleReducedMotionChange(event: MediaQueryListEvent): void {
  reducedMotion.value = event.matches
  if (event.matches) {
    pointerPosition.value = { x: 0, y: 0 }
  }
}

function clearPreviousStack(): void {
  previousStack.value = null
  transitionActive.value = false
  if (transitionTimer !== undefined) {
    clearTimeout(transitionTimer)
    transitionTimer = undefined
  }
}

async function refreshBackgroundVariant(): Promise<void> {
  const nextVariant = peekThanhVanVariant()
  if (variantsMatch(nextVariant, activeStack.value.variant)) {
    return
  }

  const generation = ++refreshGeneration
  const incomingStack = createRenderStack(nextVariant)

  try {
    await preloadDongFuStack(incomingStack.layers)
  } catch {
    return
  }

  if (generation !== refreshGeneration) {
    return
  }

  if (reducedMotion.value) {
    activeStack.value = incomingStack
    clearPreviousStack()
    return
  }

  previousStack.value = activeStack.value
  activeStack.value = incomingStack
  transitionActive.value = true

  if (transitionTimer !== undefined) {
    clearTimeout(transitionTimer)
  }
  transitionTimer = setTimeout(clearPreviousStack, 520)
}

watch(stageActive, (active, wasActive) => {
  if (wasActive && !active) {
    void refreshBackgroundVariant()
  }
})

onMounted(() => {
  reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  reducedMotion.value = reducedMotionQuery?.matches ?? false
  reducedMotionQuery?.addEventListener?.('change', handleReducedMotionChange)
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
})

onBeforeUnmount(() => {
  refreshGeneration += 1
  reducedMotionQuery?.removeEventListener?.('change', handleReducedMotionChange)
  window.removeEventListener('pointermove', handlePointerMove)
  if (transitionTimer !== undefined) {
    clearTimeout(transitionTimer)
  }
})
</script>

<template>
  <div v-if="!stageActive" class="home-scene">
    <!-- Fallback gradient cũ — chỉ nhìn thấy trong lúc ảnh base đang load. -->
    <div class="home-scene__sky" />
    <div class="home-scene__mountains home-scene__mountains--far" />
    <div class="home-scene__mountains" />
    <div class="home-scene__ground" />

    <div
      v-if="previousStack"
      class="home-scene__parallax-stack home-scene__parallax-stack--previous is-leaving"
      :class="{ 'is-reduced-motion': reducedMotion }"
      :data-season="previousStack.variant.season"
      :data-time="previousStack.variant.time"
      @animationend.self="clearPreviousStack"
    >
      <img
        v-for="layer in previousStack.layers"
        :key="layer.key"
        class="home-scene__parallax-layer"
        :class="`home-scene__parallax-layer--${layer.motion}`"
        :data-layer="layer.name"
        :data-season="previousStack.variant.season"
        :data-time="previousStack.variant.time"
        :src="layer.url"
        :style="parallaxStyle(layer)"
        alt=""
        draggable="false"
        decoding="async"
      />
    </div>

    <div
      class="home-scene__parallax-stack home-scene__parallax-stack--active"
      :class="{
        'is-entering': transitionActive,
        'is-reduced-motion': reducedMotion,
      }"
      :data-season="activeStack.variant.season"
      :data-time="activeStack.variant.time"
    >
      <img
        v-for="layer in activeStack.layers"
        :key="layer.key"
        class="home-scene__parallax-layer"
        :class="`home-scene__parallax-layer--${layer.motion}`"
        :data-layer="layer.name"
        :data-season="activeStack.variant.season"
        :data-time="activeStack.variant.time"
        :src="layer.url"
        :style="parallaxStyle(layer)"
        alt=""
        draggable="false"
        decoding="async"
      />
    </div>

    <div class="home-linhnhan">
      <div class="home-linhnhan__glow" />
      <div class="home-linhnhan__ring home-linhnhan__ring--outer" />
      <div class="home-linhnhan__ring home-linhnhan__ring--mid" />
      <div class="home-linhnhan__ring home-linhnhan__ring--inner" />
    </div>

    <div class="home-motes">
      <span style="left: 44%; top: 54%; --mx: 14px; --my: -18px; animation-delay: 0s;" />
      <span style="left: 58%; top: 58%; --mx: -12px; --my: -16px; animation-delay: 1.4s;" />
      <span style="left: 50%; top: 66%; --mx: 10px; --my: -22px; animation-delay: 2.8s;" />
      <span style="left: 52%; top: 50%; --mx: -16px; --my: -14px; animation-delay: 4.1s;" />
    </div>

    <!-- Building art shares this scene's stacking context so foreground scenery
         and the cultivating character can remain in front of it. Parallax
         style bơm qua fallthrough attrs — root của HomeBuildingIcons.vue
         tự đọc --parallax-x/y cùng cơ chế .home-scene__parallax-layer. -->
    <HomeBuildingIcons :variant="activeStack.variant" :style="buildingParallaxStyle" />

    <div class="home-player">
      <!-- Command wheel trigger (plan Workstream A/B) — ảnh tu luyện
           PNG tĩnh mới + chuyển động CSS, là trigger DUY NHẤT mở wheel.
           Nút thật (aria-label/focus-visible) cho bàn phím/touch. -->
      <button
        type="button"
        class="home-player__trigger"
        :class="{ 'is-wheel-open': ui.isCommandWheelOpen }"
        aria-label="Mở bảng lệnh Động Phủ"
        :aria-expanded="ui.isCommandWheelOpen"
        @click.stop="ui.toggleCommandWheel()"
      >
        <PlayerPortrait variant="cultivate" :animated="true" height="clamp(160px, 26vh, 239px)" />
      </button>
    </div>

    <div class="home-scene__vignette" />
  </div>
</template>

<style scoped>
.home-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: var(--ink-950);
}

.home-scene__sky {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, var(--ink-950) 0%, var(--ink-900) 38%, var(--ink-800) 62%, var(--ink-800) 100%);
}

.home-scene__mountains {
  position: absolute;
  left: 0;
  right: 0;
  top: 28%;
  height: 32%;
  background-color: var(--ink-900);
  opacity: 0.9;
  clip-path: polygon(0% 100%, 0% 62%, 9% 40%, 18% 58%, 27% 30%, 38% 52%, 48% 22%, 60% 50%, 71% 34%, 82% 56%, 91% 38%, 100% 60%, 100% 100%);
}

.home-scene__mountains--far {
  top: 32%;
  height: 30%;
  background-color: var(--ink-900);
  opacity: 0.75;
  clip-path: polygon(0% 100%, 0% 74%, 12% 56%, 24% 70%, 36% 48%, 50% 66%, 63% 46%, 76% 68%, 88% 52%, 100% 72%, 100% 100%);
}

.home-scene__ground {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 64%;
  background: linear-gradient(180deg, var(--ink-900) 0%, var(--ink-900) 55%, var(--ink-950) 100%);
  border-top: 1px solid color-mix(in srgb, var(--text-primary) 4%, transparent);
}

/* Bốn texture 1672×941 dùng cùng cover geometry để luôn khớp hình khi dịch
   nhẹ theo con trỏ; vùng bleed 2% che mép trong biên độ parallax tối đa. */
.home-scene__parallax-stack {
  position: absolute;
  inset: 0;
}

.home-scene__parallax-stack.is-entering {
  animation: dong-fu-stack-enter 520ms ease-out both;
}

.home-scene__parallax-stack.is-leaving {
  animation: dong-fu-stack-leave 520ms ease-out both;
}

.home-scene__parallax-layer {
  position: absolute;
  inset: -2%;
  width: 104%;
  height: 104%;
  object-fit: cover;
  user-select: none;
  transform: translate3d(var(--parallax-x, 0), var(--parallax-y, 0), 0);
  transition: transform 140ms cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

.home-scene__parallax-layer--cloud-slow {
  animation: dong-fu-cloud-slow 48s ease-in-out infinite alternate;
}

.home-scene__parallax-layer--cloud-medium {
  animation: dong-fu-cloud-medium 36s ease-in-out infinite alternate;
}

.home-scene__parallax-layer--mist-slow {
  animation: dong-fu-mist-slow 28s ease-in-out infinite alternate;
}

@keyframes dong-fu-stack-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dong-fu-stack-leave {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes dong-fu-cloud-slow {
  to { translate: 0.8% 0; }
}

@keyframes dong-fu-cloud-medium {
  to { translate: -1.1% 0.2%; }
}

@keyframes dong-fu-mist-slow {
  to { translate: 1.4% -0.2%; }
}

.home-scene__vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 70% 60% at 50% 46%, transparent 55%, rgba(0, 0, 0, 0.5) 100%);
}

/* ================= Linh Nhãn — vòng trận pháp dưới chân nhân vật ================= */
.home-linhnhan {
  position: absolute;
  left: 50%;
  top: 78%;
  width: 22%;
  aspect-ratio: 3 / 1;
  transform: translate(-50%, -50%);
}

.home-linhnhan__glow {
  position: absolute;
  inset: -30%;
  border-radius: 50%;
  background: radial-gradient(ellipse, color-mix(in srgb, var(--chrome-500) 14%, transparent), color-mix(in srgb, var(--azure) 7%, transparent) 55%, transparent 75%);
  filter: blur(6px);
}

.home-linhnhan__ring {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--chrome-500) 30%, transparent);
  transform: translate(-50%, -50%) perspective(320px) rotateX(64deg);
}

.home-linhnhan__ring--outer {
  width: 100%;
  height: 300%;
  border-color: color-mix(in srgb, var(--azure) 25%, transparent);
  animation: home-pulse 4.5s ease-in-out infinite;
}

.home-linhnhan__ring--mid {
  width: 74%;
  height: 220%;
  border-color: color-mix(in srgb, var(--chrome-500) 32%, transparent);
}

.home-linhnhan__ring--inner {
  width: 46%;
  height: 140%;
  border-color: color-mix(in srgb, var(--chrome-500) 48%, transparent);
  animation: home-pulse 3.2s ease-in-out infinite reverse;
}

@keyframes home-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

/* ================= Linh khí particle quanh nhân vật ================= */
.home-motes {
  position: absolute;
  inset: 0;
}

.home-motes span {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--chrome-100);
  box-shadow: 0 0 6px 2px var(--chrome-100);
  animation: home-mote 7s ease-in-out infinite;
}

@keyframes home-mote {
  0%, 100% { transform: translate(0, 0); opacity: 0.15; }
  50% { transform: translate(var(--mx, 14px), var(--my, -18px)); opacity: 0.85; }
}

/* ================= Nhân vật — trigger command wheel ================= */
/* PNG tu luyện mới (player-mortal-cultivate-v1) qua PlayerPortrait —
   chuyển động float/breathe/aura sống trong component đó; khối này chỉ
   định vị tâm màn hình và hit target. */
.home-player {
  position: absolute;
  z-index: 6;
  left: 50%;
  top: 66%;
  transform: translate(-50%, -50%);
}

/* .home-scene pointer-events:none toàn khối — trigger phải tự bật lại
   để nhận click/touch mở command wheel. */
.home-player__trigger {
  display: block;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  /* .home-scene cố ý bỏ hit-test cho toàn bộ art overlay; trigger là
     ngoại lệ tương tác duy nhất nên phải bật lại rõ ràng, giống hotspot. */
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
}

.home-player__trigger:focus-visible {
  outline: 2px solid var(--chrome-300);
  outline-offset: 4px;
  border-radius: var(--radius-md);
}

/* Khi wheel mở — aura tăng nhẹ (presentation-only). */
.home-player__trigger.is-wheel-open :deep(.player-portrait__aura) {
  opacity: 1;
  scale: 1.08;
}

@media (prefers-reduced-motion: reduce) {
  .home-scene__parallax-stack,
  .home-scene__parallax-layer {
    animation: none;
    transition: none;
    transform: none;
    translate: none;
  }
}

/* Building hotspot layer nhận --parallax-x/y qua fallthrough attrs
   (buildingParallaxStyle) — cùng transform/transition với
   .home-scene__parallax-layer để building "gắn" đúng pha với mặt đất. */
.home-scene :deep(.home-building-hotspots) {
  transform: translate3d(var(--parallax-x, 0), var(--parallax-y, 0), 0);
  transition: transform 140ms cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .home-scene :deep(.home-building-hotspots) {
    transition: none;
    transform: none;
  }
}
</style>
