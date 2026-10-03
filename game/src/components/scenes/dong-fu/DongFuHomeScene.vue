<script setup lang="ts">
// Dong Fu home world scene (scene 03, spec `vista` + dais + hotspots):
// the cultivator sits cross-legged at Linh Nhan with a light formation
// ring underfoot and spirit motes drifting by - replacing the old flat
// #0b0b10 backdrop of MainScene.vue.
//
// 2D parallax background (2026-08-30): ten aligned textures compose
// depth from far to near. The straight ground is reserved for separate
// 2D buildings, while season and time reuse the shared ThanhVanVariant
// selected by combat. DOM remains the sole background renderer to avoid
// competing pipelines.
//
// This file owns ONLY orchestration - variant stack swaps, pointer
// parallax math, and the SS14.5 focus dim/anchor blend. Every visually
// distinct region renders through a scene component under
// scenes/dong-fu/ (see docs/design/art-requests/03-dong-fu.md).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useStageActive } from '@/composables/useStageActive'
import {
  dongFuLayerList,
  type DongFuLayerDescriptor,
} from '@/presentation/background/DongFuArt'
import { preloadDongFuStack } from '@/presentation/background/DongFuStackLoader'
import { peekThanhVanVariant } from '@/presentation/background/ThanhVanBackdropArt'
import type { ThanhVanVariant } from '@/presentation/background/BackgroundVariant'
import { useUiStore } from '@/stores/ui'
import { useGameManager } from '@/composables/useGameState'
import { DONG_FU_BUILDING_ART } from '@/presentation/background/DongFuBuildingArt'
import DongFuVistaFallback from './vista/DongFuVistaFallback.vue'
import DongFuParallaxStack from './vista/DongFuParallaxStack.vue'
import DongFuLinhNhanFormation from './dais/DongFuLinhNhanFormation.vue'
import DongFuSpiritMotes from './vista/DongFuSpiritMotes.vue'
import DongFuBuildingHotspots from './hotspots/DongFuBuildingHotspots.vue'
import DongFuFocusDim from './vista/DongFuFocusDim.vue'
import DongFuCultivatorFigure from './dais/DongFuCultivatorFigure.vue'
import DongFuVignette from './vista/DongFuVignette.vue'

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
const gameManager = useGameManager()

let reducedMotionQuery: MediaQueryList | undefined
let transitionTimer: ReturnType<typeof setTimeout> | undefined
let refreshGeneration = 0

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

function variantsMatch(left: ThanhVanVariant, right: ThanhVanVariant): boolean {
  return left.season === right.season && left.time === right.time
}

// Spec SS14.5 -- clicking a building adds a slight camera drift toward it
// plus a context dim. Expressed as a blend of the normalized pointer unit
// with the building anchor's normalized scene position, so it rides the
// existing parallax mechanism without new pixel constants.
const FOCUS_BLEND = 0.4

const focusBuildingId = computed<string | null>(() => {
  if (ui.activeBuildingPopoverId) {
    return ui.activeBuildingPopoverId
  }

  const mode = ui.leftPanelMode
  if (!mode) {
    return null
  }

  const template = gameManager.buildingOps
    .getBuildingDefinitions()
    .find((building) => building.functionType === mode)

  return template?.id ?? null
})

const focusAnchor = computed(() => {
  const buildingId = focusBuildingId.value
  const art = buildingId
    ? DONG_FU_BUILDING_ART.find((entry) => entry.buildingId === buildingId)
    : undefined

  if (!art) {
    return null
  }

  return {
    xUnit: clampUnit((art.scenePlacement.xPercent - 50) / 50),
    yUnit: clampUnit((art.scenePlacement.yPercent - 50) / 50),
    xPercent: art.scenePlacement.xPercent,
    yPercent: art.scenePlacement.yPercent,
  }
})

function effectivePointerUnit(axis: 'x' | 'y'): number {
  const pointer = pointerPosition.value[axis]
  const anchor = focusAnchor.value

  if (!anchor || reducedMotion.value) {
    return pointer
  }

  const anchorUnit = axis === 'x' ? anchor.xUnit : anchor.yUnit
  return clampUnit(pointer * (1 - FOCUS_BLEND) + anchorUnit * FOCUS_BLEND)
}

function parallaxStyle(layer: DongFuLayerDescriptor) {
  const x = reducedMotion.value ? 0 : -effectivePointerUnit('x') * layer.shiftX
  const y = reducedMotion.value ? 0 : -effectivePointerUnit('y') * layer.shiftY

  return {
    '--parallax-x': `${x}px`,
    '--parallax-y': `${y}px`,
  }
}

const focusDimStyle = computed(() => {
  const anchor = focusAnchor.value

  return {
    '--focus-x': `${anchor?.xPercent ?? 50}%`,
    '--focus-y': `${anchor?.yPercent ?? 50}%`,
  }
})

// The building hotspot layer pins itself to the ground it stands on
// (bug report 2026-08-30: buildings ignored parallax and drifted against
// the ground as it followed the pointer) - reuse the exact shiftX/shiftY
// of layer '07-sect-ground' so buildings translate IN PHASE with the
// ground, offset only against the farther layers (clouds/mountains) to
// keep the depth read.
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
  <div
    v-if="!stageActive"
    class="home-scene"
    :class="{ 'is-focusing': focusAnchor !== null }"
    data-hk-scene="dong-fu"
  >
    <!-- Flat CSS stand-in, visible only while the base PNGs load. -->
    <DongFuVistaFallback />

    <DongFuParallaxStack
      v-if="previousStack"
      :variant="previousStack.variant"
      :layers="previousStack.layers"
      mode="previous"
      :reduced-motion="reducedMotion"
      :layer-style="parallaxStyle"
      @leave-done="clearPreviousStack"
    />

    <DongFuParallaxStack
      :variant="activeStack.variant"
      :layers="activeStack.layers"
      mode="active"
      :entering="transitionActive"
      :reduced-motion="reducedMotion"
      :layer-style="parallaxStyle"
    />

    <DongFuLinhNhanFormation />

    <DongFuSpiritMotes />

    <!-- Building art shares this scene's stacking context so foreground
         scenery and the cultivating character can remain in front of it.
         Parallax style pumps through fallthrough attrs - the hotspot
         layer root reads --parallax-x/y with the same mechanism as
         .home-scene__parallax-layer. -->
    <DongFuBuildingHotspots :variant="activeStack.variant" :style="buildingParallaxStyle" />

    <!-- Context dim (spec SS14.5): radial mask keeps a clear window
         around the focused building while the rest of the scene falls
         back. -->
    <DongFuFocusDim :style="focusDimStyle" />

    <DongFuCultivatorFigure />

    <DongFuVignette />
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

/* Spec SS14.5 context dim -- sits above the building hotspots (DOM
   order) but below the cultivating player, so the focused building stays
   lit while surroundings recede. The dim element is a child component
   root and carries this scope id. */
.home-scene.is-focusing .home-scene__focus-dim {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .home-scene .home-scene__focus-dim {
    animation: none;
    transition: none;
    transform: none;
    translate: none;
  }
}

/* The building hotspot layer receives --parallax-x/y through fallthrough
   attrs (buildingParallaxStyle) - same transform/transition as
   .home-scene__parallax-layer so buildings track the ground phase. */
.home-scene :deep(.home-building-hotspots) {
  transform: translate3d(var(--parallax-x, 0), var(--parallax-y, 0), 0);
  transition: transform 140ms cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .home-scene :deep(.home-building-hotspots) {
    animation: none;
    transition: none;
    transform: none;
    translate: none;
  }
}
</style>
