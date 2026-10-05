<script setup lang="ts">
// Dong Phu home stage (production host for the approved dong-fu-v2
// fidelity surface): SceneDesignCanvas 1440x810 + two-plane vista +
// shared DongFuHomeContent driven by REAL read-models. Replaces the old
// stacked HUD chrome (hotspot scene + top bar + rails) - one surface. All actions route to the existing
// owners: commandWheelCatalog slots, useBuildingNavigation, ui store
// panels, ThienCoEntry.run(), FeedbackDialog. Nothing here owns domain
// state (A7).
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useStageActive } from '@/composables/useStageActive'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import { useThienCoEntries, type ThienCoEntry } from '@/composables/useThienCoEntries'
import { useCurrencyChips } from '@/composables/useCurrencyChips'
import {
  type CommandWheelDisabledContext,
  type CommandWheelSlot,
} from '@/data/ui/commandWheelCatalog'
import { betaWheelSlots, isBetaBuildingSurface } from '@/core/betaScopeSurface'
import { DONG_FU_BUILDING_IDS } from '@/presentation/background/DongFuBuildingArt'
import { resolveExpectedArtifactId } from '@/core/artifact/Artifact'
import { ARTIFACT_UNLOCK_REALM_ID, isArtifactDomainUnlocked } from '@/core/artifact/ArtifactProgression'
import { isCompanionDomainUnlocked } from '@/core/companion/CompanionAvailability'
import { isFormationUnlocked } from '@/core/game/FormationPlacement'
import { isRealmAvailable } from '@/core/realm/ReleasePolicy'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import { useAudioStore } from '@/stores/audio'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import FeedbackDialog from '@/components/common/FeedbackDialog.vue'
import AutoFarmIndicator from '@/components/game/AutoFarmIndicator.vue'
import DongFuVista from './fidelity/DongFuVista.vue'
import DongFuHomeContent from './fidelity/DongFuHomeContent.vue'
import type { DongFuUiAction, DongFuUiBuilding, DongFuUiModel } from './fidelity/dongFuUi'

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { t } = useI18n()
const stageActive = useStageActive()
const navigation = useBuildingNavigation()
const { entries } = useThienCoEntries()
const { chips } = useCurrencyChips()

// Overlay scene canvases (stage select, character, settings, standalone
// panels...) stack a second scaled canvas above this stage - floating
// home chrome must not bleed onto their paper surfaces (audit: the
// Thien Co Bang chip overlapped the exploration journal's top-right
// corner).
const surfaceOpen = computed(
  () => ui.leftPanelMode !== null || ui.characterOverlayOpen || ui.standalonePanel !== null,
)

const feedbackOpen = ref(false)
const boardOpen = ref(true)

// Any mounted home overlay (left panel, character sheet, standalone
// paper) sits in the same stacking context as the
// home chrome but paints its paper around it - hide the board/quest
// chip instead of letting them float on top of the overlay's rim.
const homeOverlayOpen = computed(
  () => Boolean(ui.leftPanelMode) || ui.characterOverlayOpen || Boolean(ui.standalonePanel),
)
const notice = ref('')
let noticeTimer: number | undefined

function flashNotice(text: string) {
  notice.value = text
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    noticeTimer = undefined
    notice.value = ''
  }, 3200)
}
onBeforeUnmount(() => {
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
})

// ================= Wheel slots (catalog authority) =====================
// Same disabledContext the legacy wheel layer built from authoritative
// domain predicates - presentation never re-derives unlock rules.
const disabledContext = computed<CommandWheelDisabledContext>(() => ({
  artifactDomainUnlocked: isArtifactDomainUnlocked(player.realmId),
  artifactUnlockRealmAvailable: isRealmAvailable(ARTIFACT_UNLOCK_REALM_ID),
  hasArtifactDefinition: Boolean(resolveExpectedArtifactId(player)),
  companionDomainUnlocked: isCompanionDomainUnlocked(player.realmId),
  formationUnlocked: isFormationUnlocked(player.realmId),
  realmReleaseUnavailable: !isRealmAvailable(player.realmId),
}))

const renderedSlots = computed(() => betaWheelSlots().filter((slot) => slot.available()))

// Presentation-only glyph map (same table the legacy wheel used).
const SLOT_SYMBOL: Record<string, string> = {
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

function slotDisabledReason(slot: CommandWheelSlot): string | null {
  return slot.disabledReason?.(disabledContext.value) ?? null
}

function slotActive(slot: CommandWheelSlot): boolean {
  const target = slot.target
  if (target?.kind === 'left_panel') return ui.leftPanelMode === target.mode
  if (target?.kind === 'standalone') return ui.standalonePanel === target.panel
  if (slot.buildingId) {
    const { template } = navigation.getBuildingPresentation(slot.buildingId)
    return template?.functionType !== undefined && ui.leftPanelMode === template.functionType
  }
  return false
}

function slotBadge(slot: CommandWheelSlot): 'alert' | 'dot' | null {
  // canTriggerBreakthrough - the same admission gate RealmPanel uses.
  if (slot.id === 'character' && gameManager.realmAdvanceOps.canTriggerBreakthrough(player.$state)) {
    return 'alert'
  }
  if (slot.buildingId) {
    const status = navigation.getBuildingStatus(slot.buildingId)
    if (status === 'ready' || status === 'upgradeable') return 'dot'
  }
  return null
}

function slotAction(slot: CommandWheelSlot): DongFuUiAction {
  return {
    id: slot.id,
    labelKey: slot.labelKey,
    symbol: SLOT_SYMBOL[slot.id] ?? 'home',
    disabledReason: slotDisabledReason(slot),
    badge: slotBadge(slot),
    active: slotActive(slot),
  }
}

// ================= Building plaques ====================================
// Design-canvas anchors from the approved ui-dong-fu layout; the list
// itself comes from DONG_FU_BUILDING_IDS filtered by beta scope - a
// scope-hidden building renders no plaque (fail closed).
const BUILDING_ANCHORS: Record<string, { x: number; y: number; symbol: string }> = {
  chi_hien_quan: { x: 226, y: 144, symbol: 'character' },
  teleport_array: { x: 131, y: 301, symbol: 'exploration' },
  gathering_outpost: { x: 44, y: 448, symbol: 'home' },
  pill_room: { x: 292, y: 555, symbol: 'alchemy' },
  equipment_hall: { x: 978, y: 475, symbol: 'equipment' },
  vendor: { x: 1200, y: 625, symbol: 'inventory' },
}

const BUILDING_LABEL_KEY: Record<string, string> = {
  chi_hien_quan: 'panels.wheel.slots.chi_hien_quan',
  teleport_array: 'panels.wheel.slots.teleport_array',
  gathering_outpost: 'panels.wheel.slots.gathering_outpost',
  pill_room: 'panels.wheel.slots.pill_room',
  equipment_hall: 'panels.wheel.slots.equipment_hall',
  vendor: 'layout.functionOverlay.titles.vendor',
}

const buildings = computed<DongFuUiBuilding[]>(() => {
  stateVersion.value
  return DONG_FU_BUILDING_IDS.filter((id) => isBetaBuildingSurface(id)).map((id) => {
    const anchor = BUILDING_ANCHORS[id] ?? { x: 0, y: 0, symbol: 'home' }
    const status = navigation.getBuildingStatus(id)
    return {
      id,
      labelKey: BUILDING_LABEL_KEY[id] ?? 'panels.wheel.slots.settings',
      symbol: anchor.symbol,
      x: anchor.x,
      y: anchor.y,
      // 'upgrade' -> clickable gold arrow affordance on the plaque
      // (owner 2026-10-03: "nang cap hien khi du dieu kien o cho button
      // building"); 'dot' stays the passive ready/collectable marker.
      badge: status === 'upgradeable' ? 'upgrade' : status === 'ready' ? 'dot' : null,
    }
  })
})

// ================= Thien Co entries ====================================
const KIND_SYMBOL: Record<ThienCoEntry['kind'], string> = {
  breakthrough: 'realm',
  quest: 'quest',
  ready: 'auto-farm',
  active: 'exploration',
  upgradeable: 'equipment',
}

// ================= Model ==============================================
const realmName = computed(() => getCurrentRealm(player.realmId).name)

const trackedQuest = computed(() => {
  stateVersion.value
  const models = gameManager.questOps.getBetaQuestSurfaceModels()
  return models.find((model) => model.claim.available) ?? models[0]
})

const model = computed<DongFuUiModel>(() => ({
  name: player.name,
  realm: t('home.topBar.realmLine', { realm: realmName.value, level: player.realmLevel }),
  progressLabel: `${formatNumber(player.cultivation)} / ${formatNumber(player.cultivationRequired)}`,
  progressPercent: Math.min(100, Math.round(player.cultivationProgress * 100)),
  resources: chips.value.map((chip) => ({
    id: chip.id,
    label: chip.label,
    value: formatNumber(chip.amount),
  })),
  actions: renderedSlots.value.map(slotAction),
  utilities: [
    { id: 'feedback', labelKey: 'home.topBar.feedback', symbol: 'feedback' },
    { id: 'inventory', labelKey: 'home.topBar.bag', symbol: 'inventory' },
    { id: 'settings', labelKey: 'home.topBar.settings', symbol: 'settings' },
  ],
  buildings: buildings.value,
  opportunities: entries.value.map((entry) => ({
    id: entry.id,
    symbol: KIND_SYMBOL[entry.kind] ?? 'home',
    labelKey: entry.titleKey,
    labelParams: entry.titleParams,
    detailKey: entry.detailKey,
    detailParams: entry.detailParams,
    ctaKey: entry.ctaKey,
  })),
  quest: trackedQuest.value
    ? {
        name: trackedQuest.value.name,
        detail: `${Math.min(trackedQuest.value.progress, trackedQuest.value.target)}/${trackedQuest.value.target}`,
        claimable: trackedQuest.value.claim.available,
      }
    : null,
}))

// ================= Action routing ======================================
function activateSlot(slot: CommandWheelSlot) {
  if (slotDisabledReason(slot)) return
  useAudioStore().cue('ui.wheel.select')
  ui.closeCommandWheel()
  if (slot.buildingId) {
    navigation.openBuilding(slot.buildingId)
    return
  }
  const target = slot.target
  if (!target) return
  if (target.kind === 'left_panel') {
    ui.openLeftPanel(target.mode)
    return
  }
  ui.openStandalonePanel(target.panel)
}

function onAction(id: string) {
  const entry = entries.value.find((candidate) => candidate.id === id)
  if (entry) {
    entry.run()
    return
  }
  const slot = renderedSlots.value.find((candidate) => candidate.id === id)
  if (slot) {
    activateSlot(slot)
    return
  }
  if (id === 'feedback') {
    feedbackOpen.value = true
    return
  }
  if (id === 'quest') {
    ui.openStandalonePanel('quest')
    return
  }
  if (id === 'inventory' || id === 'settings' || id === 'character') {
    ui.openLeftPanel(id)
    return
  }
  if (isBetaBuildingSurface(id)) {
    navigation.openBuilding(id)
    return
  }
  flashNotice(t('dongFu.unhandled'))
}

// ================= Empty-space click + keyboard ========================
// The stage eats every click inside the scaled canvas (MainScene's own
// closeSidePanels would otherwise fire for bubbled button clicks), then
// re-implements the "empty vista click closes home overlays" contract:
// a click that lands on no interactive element closes the wheel/panels.
const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [role="button"], [data-df-ui]'

function onSceneClick(event: MouseEvent) {
  if ((event.target as HTMLElement | null)?.closest(INTERACTIVE_SELECTOR)) return
  ui.closeHomeOverlays()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    ui.closeCommandWheel()
    return
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

// ================= Pointer parallax ====================================
const pointer = shallowRef({ x: 0, y: 0 })
function move(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = {
    x: Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1)),
    y: Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1)),
  }
}
</script>

<template>
  <SceneDesignCanvas v-if="!stageActive">
    <main
      class="df-scene"
      :class="{ 'df-scene--covered': surfaceOpen }"
      :aria-label="t('dongFu.aria')"
      :style="{ '--df-x': pointer.x, '--df-y': pointer.y }"
      @pointermove="move"
      @pointerleave="pointer = { x: 0, y: 0 }"
      @click.stop="onSceneClick"
    >
      <DongFuVista />
      <DongFuHomeContent
        :model="model"
        :notice="notice"
        :selected="null"
        :wheel-open="ui.isCommandWheelOpen"
        :board-open="boardOpen"
        :occluded="homeOverlayOpen"
        @action="onAction"
        @toggle-wheel="ui.toggleCommandWheel()"
        @toggle-board="boardOpen = !boardOpen"
        @upgrade="navigation.upgradeBuilding"
      >
        <template #utilities-extra><AutoFarmIndicator /></template>
      </DongFuHomeContent>
    </main>
  </SceneDesignCanvas>
  <FeedbackDialog :open="feedbackOpen" @close="feedbackOpen = false" />
</template>

<style scoped>
/* Same root contract as the fidelity scene: the scaled 1440x810 space,
   the CSS vars the regions read, and the button resets. */
.df-scene { --df-gold: #c9a761; --df-gold-light: #ebd094; --df-ivory: #f1e6c5; position: relative; width: 100%; height: 100%; overflow: hidden; background: #101b24; color: var(--df-ivory); font-family: var(--font-display, Georgia, serif); }
.df-scene :deep(*) { box-sizing: border-box; }
.df-scene :deep(button) { font-family: inherit; font-weight: 400; }
.df-scene :deep(button:focus-visible) { outline: 2px solid #fff1b8; outline-offset: 5px; }
.df-scene :deep(button:hover) { filter: brightness(1.16); }
.df-scene :deep(button:active) { filter: brightness(1.3); }

/* While an overlay surface owns the screen, the home scene's floating
   chrome (Thien Co Bang board, quest tracker, transient notice) hides -
   the scroll envelopes are spec'd above it (z 12+ vs board z 8/11). */
.df-scene--covered :deep(.df-board),
.df-scene--covered :deep(.df-quest),
.df-scene--covered :deep(.df-notice) { display: none; }
</style>
