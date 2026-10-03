<script setup lang="ts">
// Dao Luan command wheel layer (scene 03 spec `dao-luan-hub`/`wheel-*`,
// Workstream B): opens by clicking the cultivator figure on the dais
// (trigger lives in DongFuCultivatorFigure), closes by re-click / empty-
// space click / Escape. Slots spread evenly over 360 deg  across two
// counter-rotating circular orbits following the catalog order, spiraling
// out from the center with alpha climbing through the travel.
// Owns the open/close state machine + domain resolution; the visual
// regions decompose into DongFuWheelBackdrop / DongFuWheelOrbitRing /
// DongFuWheelCenterSeal / DongFuWheelSlot.
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
import type { StableSymbolId } from '@/presentation/huyenKim/StableSceneArt'
import { hkChromeUrl } from '@/ui/huyenKimChrome'
import { useAudioStore } from '@/stores/audio'
import DongFuWheelBackdrop from './DongFuWheelBackdrop.vue'
import DongFuWheelOrbitRing from './DongFuWheelOrbitRing.vue'
import DongFuWheelCenterSeal from './DongFuWheelCenterSeal.vue'
import DongFuWheelSlot from './DongFuWheelSlot.vue'

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { t } = useI18n()

const stageActive = useStageActive()

const navigation = useBuildingNavigation()

// Ban Menh Phap Bao (2026-08-27) - runtime context for
// CommandWheelSlot.disabledReason(), built HERE (component, not
// catalog) - see the "pure-data catalog" note in commandWheelCatalog.ts.
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

// Huyen Kim S03: the disc carries a stable-art glyph; the text label
// hangs below the node. Presentation-only map - the catalog stays pure
// data (no icon field).
const SLOT_SYMBOL: Record<string, StableSymbolId> = {
  character: 'character',
  realm: 'realm',
  skill: 'skill',
  quest: 'quest',
  phap_bao: 'equipment',
  talisman_slot: 'technique',
  formation_slot: 'realm',
  companion_roster: 'character',
  teleport_array: 'exploration',
  pill_room: 'alchemy',
  gathering_outpost: 'auto-farm',
  chi_hien_quan: 'home',
  equipment_hall: 'equipment',
  scripture_pavilion: 'technique',
  settings: 'settings',
}

function slotSymbol(slot: CommandWheelSlot): StableSymbolId {
  return SLOT_SYMBOL[slot.id] ?? 'home'
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

// ================= Circular orbit layout - clamp() viewport-aware =======
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
  // Wheel sits at y=66%: bound by the real clearance below, never
  // assuming the center is mid-viewport. Smaller buttons let the ring
  // grow while keeping screen margin; the center gap must stay clear of
  // the character sprite. The 168px floor MUST NOT beat bottomFit - on
  // short windows a smaller ring beats slots spilling past the viewport
  // edge.
  // margin covers the disc half (~28px) + the label hanging below (~18px)
  // plus edge clearance - 64 keeps the bottom slot's caption off the
  // viewport edge (it was clipping at ~2px clearance).
  // (ui-audit creation-meta).
  // Huyen Kim S03 (spec scene-03): outer orbit r264 / inner r185 design px
  // on the 1672x941 canvas -> ~202/~142px at 1280x720 (scale 0.765).
  const bottomFit = height * 0.34 - 64
  const ideal = Math.max(168, Math.min(340, shortSide * 0.28))
  return Math.max(96, Math.min(ideal, bottomFit))
}

function orbitRadius(orbitIndex: number): number {
  const outer = outerOrbitRadius()
  const innerRatio = 0.7
  const ratio = innerRatio + (orbitIndex / (ORBIT_COUNT - 1)) * (1 - innerRatio)

  return outer * ratio
}

const orbitIndexes = computed(() => Array.from({ length: ORBIT_COUNT }, (_, index) => index))

// Huyen Kim SS10: orbit slots wear the dao-luan-node chrome art as their
// backdrop; state rings/borders still paint over it (CSS stays the
// fallback while the PNG is absent).
const daoLuanNodeUrl = hkChromeUrl('dao-luan-node')
const slotNodeArt = computed<Record<string, string> | undefined>(() =>
  daoLuanNodeUrl ? { backgroundImage: `url("${daoLuanNodeUrl}")` } : undefined,
)

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

// ================= Fan-out - flip the ready layer after 1 frame =========
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

// The component lives with GameRoot, so every store flip closed -> open
// must first render the collapsed-at-center state, then flip the target
// class on the NEXT frame. Setting ready only at mount would lose the
// transition on later opens and could show the wheel while the store is
// closed.
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

// ================= Active state derived from uiStore ==================
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

    return template?.functionType !== undefined && ui.leftPanelMode === template.functionType
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

// Picking a shortcut: close the wheel FIRST, then open the matching
// panel/overlay.
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
    <DongFuWheelBackdrop @dismiss="ui.closeCommandWheel()" />

    <div
      class="command-wheel"
      role="group"
      :aria-label="t('panels.wheel.aria.group')"
      :class="{ 'is-ready': isReady, 'is-closing': isClosing }"
    >
      <DongFuWheelCenterSeal :label="t('home.daoLuan.center')" />

      <DongFuWheelOrbitRing
        v-for="orbitIndex in orbitIndexes"
        :key="orbitIndex"
        :orbit-index="orbitIndex"
        :style="orbitStyle(orbitIndex)"
      />

      <DongFuWheelSlot
        v-for="slot in renderedSlots"
        :key="slot.id"
        :slot="slot"
        :label="slotLabel(slot)"
        :symbol="slotSymbol(slot)"
        :orbit-index="slotOrbitIndex(slot)"
        :active="isActive(slot)"
        :upgradeable="isUpgradeable(slot)"
        :disabled-reason="disabledReason(slot)"
        :ignited="ignitedIds.has(slot.id)"
        :breakthrough-badge="hasBreakthroughBadge(slot)"
        :orbit-style="slotStyle(slot)"
        :node-art="slotNodeArt"
        @activate="activate"
      />
    </div>
  </div>
</template>

<style scoped>
.command-wheel-layer {
  position: absolute;
  inset: 0;
  /* Above hotspots (z-index 5), under LeftPanel (10)/tooltip/combat
     overlay - the wheel must not cover panels, tooltips or combat. */
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

.command-wheel-layer.is-closing {
  pointer-events: none;
}

/* Wheel center = the cultivator figure position mid Dong Fu (same
   coordinates as .home-player in the scene). */
.command-wheel {
  position: absolute;
  left: 50%;
  top: 66%;
  width: 0;
  height: 0;
}

/* Ready-state orchestration - the orbit rings, center seal and slot
   discs are child component roots and carry this scope id, so the
   fan-out transforms stay co-owned by the layer's state machine. */
.command-wheel.is-ready .command-wheel__orbit {
  opacity: 0.72;
  transform: translate(-50%, -50%) scale(1);
}

.command-wheel.is-ready .command-wheel__center-seal {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

/* Counter-rotation keeps the caption upright; alpha climbs 0 -> 1 over
   the whole orbit travel. */
.command-wheel.is-ready .command-wheel__slot {
  opacity: 1;
  transform: rotate(var(--end-angle)) translateY(calc(-1 * var(--orbit-radius)))
    rotate(var(--end-counter-angle)) translate(-50%, -50%);
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
