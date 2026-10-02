<script setup lang="ts">
// Command wheel nhiều tầng (plan Workstream B) — mở bằng click nhân vật
// tu luyện giữa Động Phủ (trigger ở DongFuScene.vue), đóng bằng click
// lần nữa/click vùng trống/Escape. Slot phân bố đều 360° theo thứ tự
// catalog trên hai quỹ đạo tròn. Slot đi từ tâm theo cung xoắn, hai vòng
// quay ngược chiều nhau và tăng alpha trong suốt hành trình.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { useStageActive } from '@/composables/useStageActive'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import {
  type CommandWheelDisabledContext,
  type CommandWheelSlot,
} from '@/data/ui/commandWheelCatalog'
import { betaWheelSlots } from '@/core/betaScopeSurface'
import { getCommandWheelOrbitDirection } from '@/data/ui/commandWheelOrbit'
import { resolveExpectedArtifactId } from '@/core/artifact/Artifact'
import {
  ARTIFACT_UNLOCK_REALM_ID,
  isArtifactDomainUnlocked,
} from '@/core/artifact/ArtifactProgression'
import { isCompanionDomainUnlocked } from '@/core/companion/CompanionAvailability'
import { isFormationUnlocked } from '@/core/game/FormationPlacement'
import { isRealmAvailable } from '@/core/realm/ReleasePolicy'
import NotificationBadge from '@/components/common/NotificationBadge.vue'
import { useAudioStore } from '@/stores/audio'

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { t } = useI18n()

const stageActive = useStageActive()

const navigation = useBuildingNavigation()

// Bản Mệnh Pháp Bảo (2026-08-27) — context runtime cho
// CommandWheelSlot.disabledReason(), build ở ĐÂY (component, không
// phải catalog) — xem ghi chú "catalog thuần data" trong
// commandWheelCatalog.ts.
const disabledContext = computed<CommandWheelDisabledContext>(() => ({
  artifactDomainUnlocked: isArtifactDomainUnlocked(player.realmId),
  // M-F-ARTIFACT-DEFER: whether the domain's unlock realm sits inside
  // the release window - decides between the release-hidden reason and
  // the "requires Kim Dan" progression lock in the slot tooltip.
  artifactUnlockRealmAvailable: isRealmAvailable(ARTIFACT_UNLOCK_REALM_ID),
  hasArtifactDefinition: Boolean(resolveExpectedArtifactId(player)),
  // P7-M9: the M9 slots consume the authoritative domain predicates so
  // the wheel never drifts from ops/commit gates when a threshold moves.
  companionDomainUnlocked: isCompanionDomainUnlocked(player.realmId),
  formationUnlocked: isFormationUnlocked(player.realmId),
  // M-F-CEILING (C2C-12): distinguishes "locked until Truc Co" from
  // "hidden by the release ceiling" in the slot tooltips.
  realmReleaseUnavailable: !isRealmAvailable(player.realmId),
}))

function disabledReason(slot: CommandWheelSlot): string | null {
  return slot.disabledReason?.(disabledContext.value) ?? null
}

// Catalog stores labelKey (no VI string) - resolves via t() so the wheel
// follows the selected locale.
function slotLabel(slot: CommandWheelSlot): string {
  return t(slot.labelKey)
}

/**
 * BETA SCOPE LOCK v2 (Phase-6): the wheel consumes the canonical
 * filtered list - scope-hidden slots (phap_bao / formation_slot /
 * companion_roster / chi_hien_quan) never render a button or tooltip.
 * Each surviving slot's own available() still applies (future slot
 * stays hidden).
 */
const renderedSlots = computed(() => betaWheelSlots().filter((slot) => slot.available()))

const ORBIT_COUNT = 2
const ORBIT_SWEEP_DEGREES = 112
const MOTION_DURATION_MS = 320
const IGNITION_DURATION_MS = 700

// Dao Luan treatment (spec SS10.1): catalog ring 1 (cultivation core)
// rides the inner orbit; every other rendered slot rides the outer orbit.
const INNER_ORBIT_RING = 1

const orbitSlots = computed<CommandWheelSlot[][]>(() => [
  renderedSlots.value.filter((slot) => slot.ring === INNER_ORBIT_RING),
  renderedSlots.value.filter((slot) => slot.ring !== INNER_ORBIT_RING),
])

const slotOrbitLayout = computed(() => {
  const layout = new Map<string, { orbitIndex: number; indexInOrbit: number; slotsInOrbit: number }>()

  orbitSlots.value.forEach((slots, orbitIndex) => {
    slots.forEach((slot, indexInOrbit) => {
      layout.set(slot.id, { orbitIndex, indexInOrbit, slotsInOrbit: slots.length })
    })
  })

  return layout
})

function slotOrbitIndex(slot: CommandWheelSlot): number {
  return slotOrbitLayout.value.get(slot.id)?.orbitIndex ?? 0
}

// ================= Circular orbit layout — clamp() thích nghi viewport =======
const viewportSize = ref({ width: window.innerWidth, height: window.innerHeight })

function onResize() {
  viewportSize.value = { width: window.innerWidth, height: window.innerHeight }
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

function outerOrbitRadius(): number {
  const { width, height } = viewportSize.value
  const shortSide = Math.min(width, height)
  // Wheel ở y=66%: giới hạn theo khoảng trống thật phía dưới, không giả
  // định tâm nằm giữa viewport. Button nhỏ hơn cho phép vòng mở rộng mà vẫn
  // chừa mép màn hình; khoảng trống tâm phải đủ để không che sprite nhân vật.
  // Sàn 168px KHÔNG được vượt bottomFit — cửa sổ thấp thà vòng nhỏ còn hơn
  // slot tràn khỏi mép dưới viewport.
  // margin must cover HALF the slot height (~34-44px) plus edge clearance
  // - before, subtracting only 32px clipped the last orbit slot at the
  // bottom viewport edge.
  // (ui-audit creation-meta).
  const bottomFit = height * 0.34 - 56
  const ideal = Math.max(168, Math.min(340, shortSide * 0.34))
  return Math.max(96, Math.min(ideal, bottomFit))
}

function orbitRadius(orbitIndex: number): number {
  const outer = outerOrbitRadius()
  const innerRatio = 0.7
  const ratio = innerRatio + (orbitIndex / (ORBIT_COUNT - 1)) * (1 - innerRatio)

  return outer * ratio
}

const orbitIndexes = computed(() => Array.from({ length: ORBIT_COUNT }, (_, index) => index))

function orbitStyle(orbitIndex: number) {
  return {
    '--orbit-diameter': `${orbitRadius(orbitIndex) * 2}px`,
  }
}

function slotStyle(slot: CommandWheelSlot) {
  const placement = slotOrbitLayout.value.get(slot.id) ?? {
    orbitIndex: 0,
    indexInOrbit: 0,
    slotsInOrbit: 1,
  }
  const { orbitIndex, indexInOrbit, slotsInOrbit } = placement
  const ringOffsetAngle = orbitIndex === 0 ? 0 : 180 / slotsInOrbit
  const endAngle = (indexInOrbit / slotsInOrbit) * 360 + ringOffsetAngle
  const direction = getCommandWheelOrbitDirection(orbitIndex)
  const startAngle =
    direction === 'clockwise' ? endAngle - ORBIT_SWEEP_DEGREES : endAngle + ORBIT_SWEEP_DEGREES

  return {
    '--orbit-radius': `${orbitRadius(orbitIndex)}px`,
    '--start-angle': `${startAngle}deg`,
    '--end-angle': `${endAngle}deg`,
    '--start-counter-angle': `${-startAngle}deg`,
    '--end-counter-angle': `${-endAngle}deg`,
  }
}

// ================= Fan-out — bật lớp ready sau 1 frame =================
const isVisible = ref(false)
const isReady = ref(false)
const isClosing = ref(false)

// Rune ignition (spec SS10.1): a slot whose lock cleared since the last
// wheel open flashes once. Tracked per open, cleared after the cue.
const lastDisabledIds = ref<Set<string>>(new Set())
const ignitedIds = ref<ReadonlySet<string>>(new Set())

let readyHandle: number | undefined
let closeHandle: number | undefined
let igniteHandle: number | undefined

function captureIgnitionOnOpen(): void {
  const nowDisabled = new Set<string>()
  const ignited = new Set<string>()

  for (const slot of renderedSlots.value) {
    if (disabledReason(slot)) {
      nowDisabled.add(slot.id)
    } else if (lastDisabledIds.value.has(slot.id)) {
      ignited.add(slot.id)
    }
  }

  lastDisabledIds.value = nowDisabled
  ignitedIds.value = ignited

  if (igniteHandle !== undefined) {
    clearTimeout(igniteHandle)
    igniteHandle = undefined
  }

  if (ignited.size > 0) {
    igniteHandle = window.setTimeout(() => {
      igniteHandle = undefined
      ignitedIds.value = new Set()
    }, IGNITION_DURATION_MS)
  }
}

// Component sống cùng GameRoot, nên mỗi lần store chuyển closed → open
// phải render trạng thái co tại tâm trước, rồi mới bật class đích ở frame
// kế tiếp. Nếu chỉ set ready lúc component mount thì lần mở sau không còn
// transition và wheel cũng có thể hiện dù store đang đóng.
watch(
  () => ui.isCommandWheelOpen,
  async (isOpen) => {
    if (readyHandle !== undefined) {
      cancelAnimationFrame(readyHandle)
      readyHandle = undefined
    }

    if (!isOpen) {
      isReady.value = false

      if (!isVisible.value) {
        isClosing.value = false

        return
      }

      isClosing.value = true
      closeHandle = window.setTimeout(() => {
        closeHandle = undefined
        isVisible.value = false
        isClosing.value = false
      }, MOTION_DURATION_MS)

      return
    }

    if (closeHandle !== undefined) {
      clearTimeout(closeHandle)
      closeHandle = undefined
    }

    isVisible.value = true
    isReady.value = false
    isClosing.value = false
    captureIgnitionOnOpen()

    await nextTick()

    if (!ui.isCommandWheelOpen) {
      return
    }

    readyHandle = window.requestAnimationFrame(() => {
      readyHandle = undefined
      isReady.value = true
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (readyHandle !== undefined) {
    cancelAnimationFrame(readyHandle)
  }

  if (closeHandle !== undefined) {
    clearTimeout(closeHandle)
  }

  if (igniteHandle !== undefined) {
    clearTimeout(igniteHandle)
  }
})

// ================= Keyboard toggle/close wheel ========================
function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    ui.closeCommandWheel()

    return
  }

  if (
    event.key === 'Tab' &&
    !event.repeat &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !stageActive.value &&
    !isEditableTarget(event.target)
  ) {
    event.preventDefault()
    ui.toggleCommandWheel()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

// ================= Trạng thái active suy ra từ uiStore =================
function isActive(slot: CommandWheelSlot): boolean {
  const target = slot.target

  if (target?.kind === 'left_panel') {
    return ui.leftPanelMode === target.mode
  }

  if (target?.kind === 'standalone') {
    return ui.standalonePanel === target.panel
  }

  if (slot.buildingId) {
    const { template } = navigation.getBuildingPresentation(slot.buildingId)

    return (
      ui.activeBuildingPopoverId === slot.buildingId ||
      (template?.functionType !== undefined && ui.leftPanelMode === template.functionType)
    )
  }

  return false
}

function isUpgradeable(slot: CommandWheelSlot): boolean {
  return (
    slot.buildingId !== undefined &&
    navigation.getBuildingPresentation(slot.buildingId).isUpgradeable
  )
}

// Idle-conventions rework - first "new work" badge in the game (no
// unseen/new pattern existed before this wave). Breakthrough-readiness
// reads the canonical admission gate (canTriggerBreakthrough, the same
// predicate RealmPanel's Breakthrough button and triggerBreakthroughAction
// use): level + chapter-clear + release-policy rows. Raw
// cultivationProgress >= 1 lit a false "ready" dot wherever the bar
// could fill while the gate still blocked - an uncleared chapter at
// the Luyen Khi ceiling, or the release-disabled TC -> KD transition.
function hasBreakthroughBadge(slot: CommandWheelSlot): boolean {
  return (
    slot.id === 'character' &&
    gameManager.realmAdvanceOps.canTriggerBreakthrough(player.$state)
  )
}

// Icon pipeline removed (ui-audit creation-meta): public/assets/ui/wheel/
// never had assets so every <img> 404'd. When the art drop lands (manifest
// in asset-drop/README.md) restore it from git history.

// Chọn shortcut: đóng wheel TRƯỚC rồi mới mở panel/overlay tương ứng.
function activate(slot: CommandWheelSlot) {
  if (disabledReason(slot)) {
    return
  }

  // W7: wheel pick lands before the close cue (ui.wheel.close fires via
  // uiAudioBinding's isCommandWheelOpen transition below).
  useAudioStore().cue('ui.wheel.select')
  ui.closeCommandWheel()

  if (slot.buildingId) {
    navigation.openBuilding(slot.buildingId)

    return
  }

  const target = slot.target

  if (!target) {
    return
  }

  if (target.kind === 'left_panel') {
    ui.openLeftPanel(target.mode)

    return
  }

  ui.openStandalonePanel(target.panel)
}
</script>

<template>
  <div
    class="command-wheel-layer"
    :class="{
      'is-visible': isVisible && !stageActive,
      'is-ready': isReady,
      'is-closing': isClosing,
    }"
    :aria-hidden="!isVisible || stageActive"
  >
    <!-- Vùng trống (backdrop) — click đóng wheel VÀ chặn click xuyên
         xuống hotspot bên dưới khi wheel đang mở (Workstream C). -->
    <div class="command-wheel-layer__backdrop" aria-hidden="true" @click="ui.closeCommandWheel()" />

    <div
      class="command-wheel"
      role="group"
      :aria-label="t('panels.wheel.aria.group')"
      :class="{ 'is-ready': isReady, 'is-closing': isClosing }"
    >
      <!-- Dao Luan center (spec SS10.1) -- Tu Luyen seal. Chrome slot
           'dao-luan-center' is pending art; CSS seal is the fallback. -->
      <span class="command-wheel__center-seal" aria-hidden="true">{{ t('home.daoLuan.center') }}</span>

      <span
        v-for="orbitIndex in orbitIndexes"
        :key="orbitIndex"
        class="command-wheel__orbit"
        :style="orbitStyle(orbitIndex)"
        aria-hidden="true"
      />

      <button
        v-for="slot in renderedSlots"
        :key="slot.id"
        type="button"
        class="command-wheel__slot"
        :class="[
          `command-wheel__slot--ring${slot.ring}`,
          {
            'is-active': isActive(slot),
            'is-upgradeable': isUpgradeable(slot),
            'is-disabled': disabledReason(slot),
            'is-ignited': ignitedIds.has(slot.id),
          },
        ]"
        :style="slotStyle(slot)"
        :data-wheel-orbit="slotOrbitIndex(slot)"
        :aria-label="slotLabel(slot)"
        :data-wheel-slot="slot.id"
        :aria-disabled="Boolean(disabledReason(slot))"
        v-tooltip="disabledReason(slot) ?? undefined"
        @click="activate(slot)"
      >
        <span class="command-wheel__label">{{ slotLabel(slot) }}</span>

        <span v-if="isUpgradeable(slot)" class="command-wheel__upgrade-dot" aria-hidden="true" />

        <!-- 2026-08-30 frontend-design pass — slot khóa trước đây CHỈ
             phân biệt bằng opacity mờ đi, dễ đọc nhầm là "chỉ tối màu"
             thay vì "chưa bấm được". Thêm icon khóa góc dưới-phải (2 góc
             kia đã có upgrade-dot/notification-badge). -->
        <span v-if="disabledReason(slot)" class="command-wheel__lock-badge" aria-hidden="true">🔒</span>

        <NotificationBadge
          v-if="hasBreakthroughBadge(slot)"
          variant="dot"
          class="command-wheel__notification-badge"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.command-wheel-layer {
  position: absolute;
  inset: 0;
  /* Trên hotspot (z-index 5), dưới LeftPanel (10)/tooltip/combat overlay
     — wheel không được che panel, tooltip hay combat overlay. */
  z-index: 8;
  visibility: hidden;
  pointer-events: none;
}

.command-wheel-layer.is-visible {
  visibility: visible;
}

.command-wheel-layer.is-ready {
  pointer-events: auto;
}

.command-wheel-layer__backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--hk-surface-base, var(--ink-950)) 52%, transparent);
  cursor: pointer;
}

.command-wheel-layer.is-closing {
  pointer-events: none;
}

/* Tâm wheel = vị trí nhân vật tu luyện giữa Động Phủ (cùng tọa độ
   .home-player trong DongFuScene.vue). */
.command-wheel {
  position: absolute;
  left: 50%;
  top: 66%;
  width: 0;
  height: 0;
}

.command-wheel__orbit {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--orbit-diameter);
  height: var(--orbit-diameter);
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, var(--mineral-gold)) 55%, transparent);
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.92);
  transition:
    opacity 0.24s ease-out,
    transform 0.32s cubic-bezier(0.2, 0.75, 0.3, 1);
}

.command-wheel.is-ready .command-wheel__orbit {
  opacity: 0.72;
  transform: translate(-50%, -50%) scale(1);
}

/* Dao Luan center seal (spec SS10.1) -- decorative Tu Luyen marker at the
   hub; falls back to CSS while chrome slot 'dao-luan-center' is pending. */
.command-wheel__center-seal {
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border: 1px solid var(--hk-border-active, var(--mineral-gold));
  border-radius: 50%;
  background:
    radial-gradient(120% 120% at 50% 20%, var(--hk-surface-overlay, var(--ink-800)) 0%, var(--hk-surface-base, var(--ink-950)) 78%);
  box-shadow:
    inset 0 0 0 4px var(--hk-surface-base, var(--ink-950)),
    inset 0 0 0 5px color-mix(in srgb, var(--hk-gold-muted, var(--mineral-gold)) 55%, transparent),
    0 0 18px var(--hk-glow-gold, rgba(232, 195, 90, 0.35));
  color: var(--hk-gold, var(--mineral-gold));
  font-family: var(--hk-font-display, var(--font-display));
  font-size: var(--text-sm);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.6);
  transition:
    opacity 0.24s ease-out,
    transform 0.32s cubic-bezier(0.2, 0.75, 0.3, 1);
}

.command-wheel.is-ready .command-wheel__center-seal {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.command-wheel__slot {
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  min-width: 57px;
  max-width: 81px;
  min-height: 57px;
  padding: 6px 8px;
  border: 1px solid var(--hk-border-muted, var(--frame-outer));
  border-radius: 999px;
  background:
    radial-gradient(120% 120% at 50% 16%, var(--hk-surface-overlay, var(--ink-800)) 0%, var(--hk-surface-raised, var(--ink-900)) 72%);
  box-shadow: 0 3px 10px var(--hk-shadow-low, rgba(0, 0, 0, 0.4));
  color: var(--hk-text-primary, var(--paper-text));
  font-family: var(--hk-font-ui, var(--font-body));
  font-size: var(--text-xs);
  line-height: var(--lh-tight);
  text-align: center;
  cursor: pointer;
  transform: rotate(var(--start-angle)) translateY(0) rotate(var(--start-counter-angle))
    translate(-50%, -50%);
  opacity: 0;
  transition:
    opacity 0.32s ease-out,
    transform 0.32s cubic-bezier(0.2, 0.75, 0.3, 1),
    border-color 0.15s ease,
    background 0.15s ease;
  will-change: transform, opacity;
  -webkit-tap-highlight-color: transparent;
}

/* Counter-rotation giữ chữ thẳng; alpha tăng từ 0 lên 1 trên toàn quỹ đạo. */
.command-wheel.is-ready .command-wheel__slot {
  opacity: 1;
  transform: rotate(var(--end-angle)) translateY(calc(-1 * var(--orbit-radius)))
    rotate(var(--end-counter-angle)) translate(-50%, -50%);
}

.command-wheel__slot:hover,
.command-wheel__slot:focus-visible {
  border-color: var(--hk-gold, var(--cinnabar));
  color: var(--hk-gold-bright, var(--cinnabar));
}

.command-wheel__slot:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--hk-glow-gold, color-mix(in srgb, var(--cinnabar) 55%, transparent));
}

/* Bản Mệnh Pháp Bảo (2026-08-27) — slot render được nhưng tạm chưa bấm
   được (disabledReason), khác hẳn "không tồn tại" (available=false,
   không render nút nào cả). */
.command-wheel__slot.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.command-wheel__slot.is-disabled:hover,
.command-wheel__slot.is-disabled:focus-visible {
  border-color: var(--hk-border-muted, var(--frame-outer));
  color: var(--hk-ink, var(--paper-text));
}

/* Active state suy ra từ uiStore (panel/popover đang mở). */
.command-wheel__slot.is-active {
  border-color: var(--hk-gold, var(--mineral-gold));
  box-shadow: inset 0 0 0 2px var(--hk-border-active, var(--mineral-gold));
  color: var(--hk-text-primary, var(--paper-text));
}

/* Rune ignition (spec SS10.1) -- one-shot gold flash when a slot's lock
   cleared since the previous wheel open. */
@keyframes dao-luan-ignite {
  0% {
    box-shadow:
      0 0 22px 4px var(--hk-glow-gold, rgba(232, 195, 90, 0.35)),
      inset 0 0 0 2px var(--hk-gold-bright, var(--mineral-gold));
    filter: brightness(1.6);
  }
  100% {
    box-shadow: 0 3px 10px var(--hk-shadow-low, rgba(0, 0, 0, 0.4));
    filter: none;
  }
}

.command-wheel__slot.is-ignited {
  animation: dao-luan-ignite 700ms var(--hk-ease-standard, ease-out) both;
}

/* Ring màu nhận diện nhẹ theo tầng. */
.command-wheel__slot--ring1 {
  border-left: 3px solid var(--hk-jade, var(--chrome-500));
}
.command-wheel__slot--ring2 {
  border-left: 3px solid var(--hk-gold, var(--azure));
}
.command-wheel__slot--ring3 {
  border-left: 3px solid var(--hk-jade-deep, var(--jade));
}
.command-wheel__slot--ring4 {
  border-left: 3px solid var(--hk-ink, var(--el-primordial));
}

/* Same upgrade indicator as the hotspot (Workstream C) -- slow breath,
   not rapid blink (spec SS10.1 unread/ready cue). */
.command-wheel__upgrade-dot {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--hk-gold-bright, var(--chrome-500));
  animation: hk-breath var(--hk-motion-breath, 2400ms) var(--hk-ease-standard, ease-in-out) infinite;
}

.command-wheel__notification-badge {
  position: absolute;
  left: 6px;
  top: 6px;
  border-radius: 50%;
  animation: hk-breath var(--hk-motion-breath, 2400ms) var(--hk-ease-standard, ease-in-out) infinite;
}

.command-wheel__lock-badge {
  position: absolute;
  right: 6px;
  bottom: 4px;
  font-size: 10px;
  line-height: 1;
  opacity: 0.85;
}

@media (prefers-reduced-motion: reduce) {
  .command-wheel__orbit,
  .command-wheel__slot,
  .command-wheel__center-seal {
    transition-duration: 0.01ms;
    transition-delay: 0ms;
  }

  .command-wheel__slot.is-ignited,
  .command-wheel__upgrade-dot,
  .command-wheel__notification-badge {
    animation: none;
  }
}
</style>
