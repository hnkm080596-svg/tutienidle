<script setup lang="ts">
// Dong Phu home stage (production host for the approved landscape-design
// surface): SceneDesignCanvas 1440x810 + warm vista + left navigation rail
// + profile/quest chrome driven by REAL read-models. The
// command wheel stays mounted alongside (Backquote) pending its redesign. All
// actions route to the existing owners: commandWheelCatalog slots,
// useBuildingNavigation, ui store panels, ThienCoEntry.run(),
// FeedbackDialog. Nothing here owns domain state (A7).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useStageActive } from '@/composables/useStageActive'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import { useThienCoEntries } from '@/composables/useThienCoEntries'
import { useCurrencyChips } from '@/composables/useCurrencyChips'
import {
  HOME_RAIL_ENTRIES,
  HOME_RAIL_ENTRY_BY_ID,
  WHEEL_SLOT_SYMBOL,
  type CommandWheelDisabledContext,
  type CommandWheelSlot,
} from '@/data/ui/homeNavigationCatalog'
import { betaWheelSlots, isBetaStandalonePanel } from '@/core/betaScopeSurface'
import { isBetaTechniqueSurfaceUnlocked } from '@/core/betaScopeTechniqueDomain'
import { resolveExpectedArtifactId } from '@/core/artifact/Artifact'
import { ARTIFACT_UNLOCK_REALM_ID, isArtifactDomainUnlocked } from '@/core/artifact/ArtifactProgression'
import { isCompanionDomainUnlocked } from '@/core/companion/CompanionAvailability'
import { isFormationUnlocked } from '@/core/game/FormationPlacement'
import { isRealmAvailable } from '@/core/realm/ReleasePolicy'
import { formatNumber } from '@/core/format/NumberFormatter'
import { useAudioStore } from '@/stores/audio'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { trackedHomeQuest } from '@/presentation/questUi'
import type { PcPaperIcon } from '@/presentation/assets/PcPaperIcons'
import '@/assets/pc-paper-scene.css'
import { pcPaperControlStyles, pcPaperResourceUrl, type PcPaperResource } from '@/presentation/assets/PcPaperControls'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import FeedbackDialog from '@/components/common/FeedbackDialog.vue'
import ExpeditionBattleStage from '@/components/game/ExpeditionBattleStage.vue'
import DongFuWheel from './fidelity/DongFuWheel.vue'
import DongFuBoard from './fidelity/DongFuBoard.vue'
import DongFuChatbox from './fidelity/DongFuChatbox.vue'
import type { DongFuUiAction } from './fidelity/dongFuUi'

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
// home chrome must not bleed onto their paper surfaces.
// Slice 3.2 (V1): `ui.activeHomeSurface` is the single authority for all
// home overlays (including `'feedback'`).
const feedbackOpen = computed(() => ui.activeHomeSurface === 'feedback')
const surfaceOpen = computed(
  () => ui.activeHomeSurface !== null && ui.activeHomeSurface !== 'feedback',
)

const boardOpen = ref(true)
const railCollapsed = ref(true)
const railIndicator = ref(true)

function toggleRail() {
  railCollapsed.value = !railCollapsed.value
  // Indicator only appears once the slide-out finished; it disappears the
  // moment the rail starts sliding back in.
  if (!railCollapsed.value) railIndicator.value = false
}

function onRailTransitionEnd(event: TransitionEvent) {
  if (event.propertyName === 'transform' && railCollapsed.value) railIndicator.value = true
}

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
// Kept verbatim for the Backquote-opened command wheel (ruling: wheel stays
// until its redesign lands).
const disabledContext = computed<CommandWheelDisabledContext>(() => ({
  artifactDomainUnlocked: isArtifactDomainUnlocked(player.realmId),
  artifactUnlockRealmAvailable: isRealmAvailable(ARTIFACT_UNLOCK_REALM_ID),
  hasArtifactDefinition: Boolean(resolveExpectedArtifactId(player)),
  companionDomainUnlocked: isCompanionDomainUnlocked(player.realmId),
  formationUnlocked: isFormationUnlocked(player.realmId),
  realmReleaseUnavailable: !isRealmAvailable(player.realmId),
}))

const renderedSlots = computed(() => betaWheelSlots().filter((slot) => slot.available()))

function slotDisabledReason(slot: CommandWheelSlot): string | null {
  return slot.disabledReason?.(disabledContext.value) ?? null
}

function slotActive(slot: CommandWheelSlot): boolean {
  const target = slot.target
  if (target?.kind === 'left_panel') return ui.activeHomeSurface === target.mode
  if (target?.kind === 'standalone') return ui.activeHomeSurface === target.panel
  if (slot.buildingId) {
    const { template } = navigation.getBuildingPresentation(slot.buildingId)
    return template?.functionType !== undefined && ui.activeHomeSurface === template.functionType
  }
  return false
}

function slotBadge(slot: CommandWheelSlot): 'alert' | 'dot' | null {
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
    symbol: WHEEL_SLOT_SYMBOL[slot.id] ?? 'home',
    disabledReason: slotDisabledReason(slot),
    badge: slotBadge(slot),
    active: slotActive(slot),
  }
}

const wheelActions = computed<DongFuUiAction[]>(() => renderedSlots.value.map(slotAction))

const KIND_SYMBOL: Record<string, string> = {
  breakthrough: 'realm',
  quest: 'quest',
  ready: 'auto-farm',
  attribute_points: 'character',
  active: 'exploration',
  upgradeable: 'equipment',
  auto_farm: 'auto-farm',
}

const boardEntries = computed(() =>
  entries.value.map((entry) => ({
    id: entry.id,
    symbol: KIND_SYMBOL[entry.kind] ?? 'home',
    labelKey: entry.titleKey,
    labelParams: entry.titleParams,
    detailKey: entry.detailKey,
    detailParams: entry.detailParams,
    ctaKey: entry.ctaKey,
  })),
)

// ================= Landscape chrome (homeNavigationCatalog authority) ==
const sceneBackground = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/world-vista-warm-v1.png')
const sceneStyle = {
  backgroundImage: `url("${sceneBackground}")`,
  ...pcPaperControlStyles(),
  '--home-nav-art': `url("${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-medallion-v1.png')}")`,
} as const
const navBackingUrl = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-backing-dark-v3.png')
const navSeamUrl = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-landscape-seam-v1.png')

function navLocked(id: PcPaperIcon): boolean {
  const entry = HOME_RAIL_ENTRY_BY_ID[id]
  if (!entry || entry.staticLocked) return true
  if (entry.requiresTechniqueUnlock && !isBetaTechniqueSurfaceUnlocked(player.$state)) return true
  return entry.betaStandaloneGate !== undefined && !isBetaStandalonePanel(entry.betaStandaloneGate)
}

function navActive(id: PcPaperIcon): boolean {
  if (navLocked(id)) return false
  if (id === 'home') return !ui.hasHomeOverlayOpen
  const entry = HOME_RAIL_ENTRY_BY_ID[id]
  return entry?.surfaceId !== null && ui.activeHomeSurface === entry?.surfaceId
}

function navAction(id: PcPaperIcon) {
  if (navLocked(id)) return
  useAudioStore().cue('ui.wheel.select')
  if (id === 'home') {
    ui.closeHomeOverlays()
    return
  }
  const entry = HOME_RAIL_ENTRY_BY_ID[id]
  if (!entry) return
  if (entry.buildingId) {
    navigation.openBuilding(entry.buildingId)
    return
  }
  if (entry.opensArchitecture) {
    ui.openArchitecture()
    return
  }
  if (entry.surfaceId) {
    ui.openHomeSurface(entry.surfaceId)
  }
}



// ================= Currencies / quest ==================================
const CHIP_ICON_BY_ID: Record<string, PcPaperResource> = {
  attribute_points: 'crystal',
}
// Dedicated icon art (2026-10-12 commission) overrides the generic
// resource glyphs per chip id.
const CHIP_ICON_FILE_BY_ID: Record<string, string> = {
  material_spirit_stone: '/assets/materials/spirit_stone_ha_pham.png',
  bui_go: '/assets/materials/bui_go.png',
  luyen_dan_tinh_hoa: '/assets/materials/luyen_dan_tinh_hoa.png',
  luyen_khi_tinh_hoa: '/assets/materials/luyen_khi_tinh_hoa.png',
  tinh_hoa_pham_the: '/assets/materials/tinh_hoa_pham_the.png',
  skill_insight: '/assets/currency/skill_insight.png',
  duyen_phan: '/assets/currency/duyen_phan.png',
  chieu_hien_lenh: '/assets/materials/chieu_hien_lenh.png',
}
const CHIP_ICON_BY_INDEX: Record<number, PcPaperResource> = { 0: 'crystal', 1: 'jade', 2: 'coin' }
const currencyChips = computed(() => {
  stateVersion.value
  return chips.value.map((chip, index) => ({
    id: chip.id,
    label: chip.label,
    icon: CHIP_ICON_BY_ID[chip.id] ?? CHIP_ICON_BY_INDEX[index] ?? 'essence',
    iconFile: CHIP_ICON_FILE_BY_ID[chip.id],
    value: formatNumber(chip.amount),
  }))
})

const trackedQuest = computed(() => {
  stateVersion.value
  const models = gameManager.questOps.getBetaQuestSurfaceModels()
  return trackedHomeQuest(models)
})

const questCard = computed(() => {
  const model = trackedQuest.value
  if (!model) return null
  const target = Math.max(1, model.target)
  return {
    name: model.name,
    detail: `${Math.min(model.progress, model.target)}/${model.target}`,
    claimable: model.claim.available,
    percent: Math.min(100, Math.round((Math.min(model.progress, model.target) / target) * 100)),
  }
})

// ================= Action routing (wheel + entries) ====================
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

function onWheelAction(id: string) {
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
  flashNotice(t('dongFu.unhandled'))
}

// ================= Empty-space click + keyboard ========================
// Same contract as before: a click that lands on no interactive element
// closes the wheel/panels.
const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [role="button"], [data-df-ui]'

function onSceneClick(event: MouseEvent) {
  if ((event.target as HTMLElement | null)?.closest(INTERACTIVE_SELECTOR)) return
  // Owner ruling 2026-10-11: open rail carries no collapse indicator -
  // clicking empty scene ground closes it (the '>>' indicator then shows).
  if (!railCollapsed.value) railCollapsed.value = true
  ui.closeHomeOverlays()
}

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
    // Owner ruling 2026-10-11: Escape is the shared close key - when no
    // surface is up it collapses the rail like clicking empty ground.
    if (!surfaceOpen.value && !railCollapsed.value) railCollapsed.value = true
    ui.closeCommandWheel()
    return
  }
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  if (isEditableTarget(event.target)) return
  // Both rail and wheel are gated on !surfaceOpen: while a panel covers
  // the canvas, toggling either would mutate UI the user cannot see.
  if (event.key === 'Tab' && !stageActive.value && !surfaceOpen.value) {
    event.preventDefault()
    toggleRail()
    return
  }
  // The wheel must not open while a surface is up: it mounts inside the
  // canvas, so it would stay invisible under the panel and pop up open
  // when the panel closes.
  if (event.key === '`' && !stageActive.value && !ui.hasHomeOverlayOpen) {
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
</script>

<template>
  <SceneDesignCanvas v-if="!stageActive">
    <main
      class="df-scene hk-art-scene landscape-design"
      data-hk-scene="dong-fu"
      :class="{ 'df-scene--covered': surfaceOpen, 'df-scene--rail-collapsed': railCollapsed }"
      :aria-label="t('dongFu.aria')"
      :style="sceneStyle"
      @click.stop="onSceneClick"
    >
      <div class="home-design-currencies" data-df-ui>
        <PcPaperButton v-for="chip in currencyChips" :key="chip.id" variant="currency" :aria-label="chip.label" :data-material="chip.id" :data-currency-id="chip.id">
          <img :src="chip.iconFile ? resolveAssetUrl(chip.iconFile) : pcPaperResourceUrl(chip.icon)" alt=""><b>{{ chip.value }}</b><span>＋</span>
        </PcPaperButton>
      </div>
      <aside class="home-navigation-surface" data-df-ui @transitionend="onRailTransitionEnd">
        <img class="home-navigation-backing" :src="navBackingUrl" alt="">
        <nav class="home-independent-navigation">
          <button
            v-for="{ id } in HOME_RAIL_ENTRIES"
            :key="id"
            type="button"
            :class="{ active: navActive(id), locked: navLocked(id) }"
            :disabled="navLocked(id)"
            :aria-label="t(`dongFu.nav.${id}`)"
            @click="navAction(id)"
          >
            <img :src="resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/icons/navigation-${id}-v2.png`)" alt="">
            <span>{{ t(`dongFu.nav.${id}`) }}</span>
          </button>
        </nav>
      </aside>
      <img v-if="surfaceOpen" class="home-navigation-landscape-seam" :src="navSeamUrl" alt="">
      <button
        v-if="railCollapsed && railIndicator && !ui.hasHomeOverlayOpen"
        class="home-navigation-toggle"
        type="button"
        :aria-label="t('dongFu.railOpen')"
        :aria-expanded="false"
        @click.stop="toggleRail()"
      >»</button>
      <DongFuWheel
        :actions="wheelActions"
        :selected="null"
        :open="ui.isCommandWheelOpen"
        @action="onWheelAction"
      />
      <DongFuBoard
        :entries="boardEntries"
        :quest="questCard"
        :open="boardOpen"
        @toggle="boardOpen = !boardOpen"
        @action="onWheelAction"
        @quest-click="ui.openStandalonePanel('quest')"
      />
      <DongFuChatbox />
      <ExpeditionBattleStage v-if="!surfaceOpen" />
      <div class="df-notice" role="status" aria-live="polite" data-df-ui>{{ notice }}</div>
      <div class="pc-paper-scene__frame" aria-hidden="true" />
    </main>
  </SceneDesignCanvas>
  <FeedbackDialog rail :open="feedbackOpen" @close="ui.closeHomeOverlays()" />
</template>

<style scoped>
/* Same root contract as the fidelity scene: the scaled 1440x810 space,
   the CSS vars the regions read, and the button resets. */
.df-scene { --df-gold: #c9a761; --df-gold-light: #ebd094; --df-ivory: #f1e6c5; position: relative; width: 100%; height: 100%; overflow: hidden; color: var(--df-ivory); font-family: var(--font-display, Georgia, serif); }
.df-scene :deep(*) { box-sizing: border-box; }
.df-scene :deep(button) { font-family: inherit; font-weight: 400; }
.df-scene :deep(button:focus-visible) { outline: 2px solid var(--df-gold, #c9a761); outline-offset: 2px; }

.landscape-design { background-size: 100% 100%; }

/* ------ mock-verbatim: left navigation rail ------------------------- */
.home-navigation-surface { position:absolute;left:18px;top:12.5%;width:335px;height:75%;z-index:23;overflow:visible;transition:transform 260ms ease; }
.df-scene--rail-collapsed .home-navigation-surface { transform:translateX(-107%); }
.home-navigation-backing { position:absolute;top:-4.07%;left:0;width:100%;height:107.07%;object-fit:contain;pointer-events:none; }
.home-navigation-landscape-seam { position:absolute;left:260px;top:12.5%;width:125px;height:75%;object-fit:cover;z-index:22;pointer-events:none;transition:transform 260ms ease; }
.df-scene--rail-collapsed .home-navigation-landscape-seam { transform:translateX(-280px);opacity:0; }
.home-navigation-toggle { position:absolute;left:0;top:50%;transform:translateY(-50%);z-index:24;width:30px;height:88px;padding:0;border:1px solid #a9863f;border-radius:0 8px 8px 0;background:linear-gradient(#3a3a2c,#22241c);color:#e8cf93;font-size:17px;cursor:pointer; }
.home-navigation-toggle:hover { color:#ffe9ae; }
.home-navigation-collapse { position:absolute;right:-30px;top:50%;transform:translateY(-50%);z-index:24;width:30px;height:88px;padding:0;border:1px solid #a9863f;border-radius:0 8px 8px 0;background:linear-gradient(#3a3a2c,#22241c);color:#e8cf93;font-size:17px;cursor:pointer; }
.home-navigation-collapse:hover { color:#ffe9ae; }
.home-independent-navigation { position:absolute;inset:12px 8px;z-index:1;display:flex;flex-direction:column;gap:20px;padding:8px 6px 8px 29px;overflow-y:auto;scrollbar-width:none;overscroll-behavior:contain;background:transparent; }
.home-independent-navigation::-webkit-scrollbar { display:none; }
.home-independent-navigation button { position:relative;flex:none;height:65px;width:235px;display:flex;align-items:center;padding:7px 14px 7px 9px;gap:18px;border:0;background:transparent;color:#efdcb6;font:700 17px var(--pc-font-body);cursor:pointer; }
.home-independent-navigation button { transition:transform 180ms ease,filter 180ms ease;transform-origin:left center; }
.home-independent-navigation button.active { transform:scale(1.1);filter:none;color:#efdcb6; }
.home-independent-navigation button.active::before { filter:brightness(1.22) drop-shadow(0 0 4px #ffd279) drop-shadow(0 0 9px #df9b3f90); }
.home-independent-navigation img { position:absolute;left:39px;top:48%;transform:translateY(-50%);width:35px;height:35px;object-fit:contain; }
.home-independent-navigation button>span { margin-left:84px; }
@media (prefers-reduced-motion: no-preference) {
  .home-independent-navigation button.active>span {
    background: linear-gradient(100deg, #efdcb6 36%, #ffffff 50%, #efdcb6 64%);
    background-size: 300% 100%;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
    animation: home-nav-glow-sweep 3.2s linear infinite;
  }
}
@keyframes home-nav-glow-sweep { 0% { background-position: 130% 0 } 100% { background-position: -30% 0 } }
.home-independent-navigation button::before { content:"";position:absolute;inset:0;z-index:-1;background:var(--home-nav-art) center/contain no-repeat; }
.home-independent-navigation button.locked { filter:grayscale(1);opacity:.48;cursor:default; }

/* ------ top right currencies + Thien Co Bang ------------------------- */
.home-design-currencies { position:absolute;right:30px;top:14px;display:flex;gap:8px; }
.home-design-currencies .pc-paper-button { display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 8px;min-height:38px;font-size:15px;min-width:122px; }
.home-design-currencies img { width:24px;height:24px;object-fit:contain; }

/* Thien Co Bang unified board (quest tracker + actionable entries). */
.df-scene :deep(.df-board) { top: 76px; right: 30px; width: 295px; }
.df-scene :deep(.df-board__heading) { font-size: 20px; }

/* Floating chrome hidden while an overlay surface owns the screen. */
.df-scene--covered :deep(.df-board),
.df-scene--covered :deep(.df-chatbox),
.df-scene--covered :deep(.df-notice) { display: none; }
.df-notice { position:absolute;top:110px;left:420px;color:#392e1d;text-shadow:0 1px #fff1d7;background:#f4e8cfcc; }
.df-notice:empty { display:none; }
</style>
