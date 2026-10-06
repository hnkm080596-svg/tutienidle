<script setup lang="ts">
// Dong Phu home stage (production host for the approved landscape-design
// surface): SceneDesignCanvas 1440x810 + warm vista + left navigation rail
// + profile/quest chrome driven by REAL read-models. The
// command wheel stays mounted alongside (Backquote) pending its redesign. All
// actions route to the existing owners: commandWheelCatalog slots,
// useBuildingNavigation, ui store panels, ThienCoEntry.run(),
// FeedbackDialog. Nothing here owns domain state (A7).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useStageActive } from '@/composables/useStageActive'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import { useThienCoEntries } from '@/composables/useThienCoEntries'
import { useCurrencyChips } from '@/composables/useCurrencyChips'
import {
  type CommandWheelDisabledContext,
  type CommandWheelSlot,
} from '@/data/ui/commandWheelCatalog'
import { betaWheelSlots, isBetaStandalonePanel } from '@/core/betaScopeSurface'
import { resolveExpectedArtifactId } from '@/core/artifact/Artifact'
import { ARTIFACT_UNLOCK_REALM_ID, isArtifactDomainUnlocked } from '@/core/artifact/ArtifactProgression'
import { isCompanionDomainUnlocked } from '@/core/companion/CompanionAvailability'
import { isFormationUnlocked } from '@/core/game/FormationPlacement'
import { isRealmAvailable } from '@/core/realm/ReleasePolicy'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import { useAudioStore } from '@/stores/audio'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { pcPaperIconUrl, type PcPaperIcon } from '@/presentation/assets/PcPaperIcons'
import '@/assets/pc-paper-scene.css'
import { pcPaperControlStyles, pcPaperResourceUrl, type PcPaperResource } from '@/presentation/assets/PcPaperControls'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import FeedbackDialog from '@/components/common/FeedbackDialog.vue'
import AutoFarmIndicator from '@/components/game/AutoFarmIndicator.vue'
import DongFuWheel from './fidelity/DongFuWheel.vue'
import DongFuBoard from './fidelity/DongFuBoard.vue'
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
const surfaceOpen = computed(
  () => ui.leftPanelMode !== null || ui.characterOverlayOpen || ui.standalonePanel !== null,
)

const feedbackOpen = ref(false)
const boardOpen = ref(true)
const railCollapsed = ref(false)
const railIndicator = ref(false)
// The dialog and every other surface are mutually exclusive: any seam
// (wheel, rail, building hotspot, board CTA) that opens a surface also
// dismisses the dialog, whichever path opened it.
watch(surfaceOpen, (open) => {
  if (open) feedbackOpen.value = false
})

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

const wheelActions = computed<DongFuUiAction[]>(() => renderedSlots.value.map(slotAction))

// Thien Co Bang board - kept alongside the new chrome pending its
// redesign (owner ruling: keep for now).
const KIND_SYMBOL: Record<string, string> = {
  breakthrough: 'realm',
  quest: 'quest',
  ready: 'auto-farm',
  active: 'exploration',
  upgradeable: 'equipment',
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

// ================= Landscape chrome (landscape-design mock) ============
const sceneBackground = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/world-vista-warm-v1.png')
const sceneStyle = {
  backgroundImage: `url("${sceneBackground}")`,
  ...pcPaperControlStyles(),
  '--home-nav-art': `url("${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-medallion-v1.png')}")`,
} as const
const navBackingUrl = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-backing-dark-v3.png')
const navSeamUrl = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/navigation-landscape-seam-v1.png')

// Rail order + lock set copied verbatim from the approved mock: the five
// locked entries are domains with no beta surface yet (artifact/companion/
// guild/sect/portal render grayscale like the design).
const NAV_LOCKED: readonly PcPaperIcon[] = ['artifact', 'companion', 'guild', 'sect', 'portal']
const NAV_ITEMS: readonly PcPaperIcon[] = [
  'home', 'character', 'skill', 'equipment', 'body', 'technique', 'realm',
  'inventory', 'alchemy', 'formation', 'exploration', 'quest', 'production',
  'vendor', 'settings', 'feedback', ...NAV_LOCKED,
]

// A nav id renders locked when the surface behind it is scope-hidden:
// 'formation' -> the tran_phap standalone panel is feature-gated off, so
// the button must read like the other locked entries instead of
// looking clickable and failing closed on tap.
const NAV_FEATURE_LOCKED: Partial<Record<PcPaperIcon, string>> = {
  formation: 'tran_phap',
}
function navLocked(id: PcPaperIcon): boolean {
  if (NAV_LOCKED.includes(id)) return true
  const panel = NAV_FEATURE_LOCKED[id]
  return panel !== undefined && !isBetaStandalonePanel(panel)
}

// Nav id -> the real surface it opens. Building-backed destinations reuse
// useBuildingNavigation so a scope-hidden building fails closed the same
// way it does from the wheel.
const NAV_TARGET: Partial<Record<PcPaperIcon, () => void>> = {
  character: () => ui.openLeftPanel('character'),
  skill: () => ui.openStandalonePanel('skill'),
  equipment: () => navigation.openBuilding('equipment_hall'),
  body: () => ui.openStandalonePanel('body'),
  technique: () => ui.openStandalonePanel('technique'),
  realm: () => ui.openStandalonePanel('realm'),
  inventory: () => ui.openLeftPanel('inventory'),
  alchemy: () => navigation.openBuilding('pill_room'),
  formation: () => ui.openStandalonePanel('tran_phap'),
  exploration: () => ui.openLeftPanel('stage_select'),
  quest: () => ui.openStandalonePanel('quest'),
  production: () => navigation.openBuilding('gathering_outpost'),
  vendor: () => navigation.openBuilding('vendor'),
  settings: () => ui.openLeftPanel('settings'),
  feedback: () => {
    ui.closeHomeOverlays()
    feedbackOpen.value = true
  },
}

// Which panel a nav id reads as "open" - mirrors the surface each target
// opens above (building ids resolve through their functionType panel).
const NAV_ACTIVE_PANEL: Partial<Record<PcPaperIcon, LeftPanelModeMarker>> = {
  equipment: 'equipment_hall',
  alchemy: 'pill_room',
  exploration: 'stage_select',
  production: 'exploration',
  vendor: 'vendor',
  settings: 'settings',
}
type LeftPanelModeMarker = 'equipment_hall' | 'pill_room' | 'exploration' | 'stage_select' | 'worker_lodge' | 'vendor' | 'settings'
const NAV_ACTIVE_STANDALONE: Partial<Record<PcPaperIcon, 'skill' | 'realm' | 'quest' | 'tran_phap' | 'technique' | 'body'>> = {
  skill: 'skill',
  realm: 'realm',
  quest: 'quest',
  formation: 'tran_phap',
  technique: 'technique',
  body: 'body',
}

function navActive(id: PcPaperIcon): boolean {
  if (id === 'home') return !surfaceOpen.value && !feedbackOpen.value
  // 'character'/'inventory' live behind the shared overlay boolean +
  // characterSceneTab, not leftPanelMode (ui store lines ~206).
  if ((id === 'character' || id === 'inventory') && ui.characterOverlayOpen && ui.characterSceneTab === id) return true
  const left = NAV_ACTIVE_PANEL[id]
  if (left && ui.leftPanelMode === left) return true
  const standalone = NAV_ACTIVE_STANDALONE[id]
  if (standalone && ui.standalonePanel === standalone) return true
  if (id === 'feedback' && feedbackOpen.value) return true
  return false
}

function navAction(id: PcPaperIcon) {
  if (navLocked(id)) return
  useAudioStore().cue('ui.wheel.select')
  // feedbackOpen lives in this component, outside closeHomeOverlays -
  // every other rail action (home included) must close the dialog too.
  if (id !== 'feedback') feedbackOpen.value = false
  if (id === 'home') {
    ui.closeHomeOverlays()
    return
  }
  NAV_TARGET[id]?.()
}



// ================= Profile / currencies / quest ========================
const realmName = computed(() => getCurrentRealm(player.realmId).name)

const CHIP_ICON: Record<number, PcPaperResource> = { 0: 'crystal', 1: 'jade', 2: 'coin', 3: 'essence' }
const currencyChips = computed(() => {
  stateVersion.value
  return chips.value.map((chip, index) => ({
    id: chip.id,
    label: chip.label,
    icon: CHIP_ICON[index] ?? 'essence',
    value: formatNumber(chip.amount),
  }))
})

const trackedQuest = computed(() => {
  stateVersion.value
  const models = gameManager.questOps.getBetaQuestSurfaceModels()
  return models.find((model) => model.claim.available) ?? models[0]
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

const profileProgress = computed(() => Math.min(100, Math.round(player.cultivationProgress * 100)))

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
  if (event.key === '`' && !stageActive.value && !surfaceOpen.value && !feedbackOpen.value) {
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
      <header class="home-design-profile" data-df-ui>
        <div class="home-design-avatar"><img :src="pcPaperIconUrl('character')" alt=""></div>
        <div>
          <h2>{{ player.name }}</h2>
          <p>{{ realmName }} {{ player.realmLevel }} <span class="home-design-progress"><i :style="{ width: `${profileProgress}%` }" /></span></p>
        </div>
      </header>
      <div class="home-design-currencies" data-df-ui>
        <PcPaperButton v-for="chip in currencyChips" :key="chip.id" variant="secondary" :aria-label="chip.label">
          <img :src="pcPaperResourceUrl(chip.icon)" alt=""><b>{{ chip.value }}</b><span>＋</span>
        </PcPaperButton>
      </div>
      <button
        v-if="questCard"
        type="button"
        class="home-design-quest"
        :class="{ 'is-claimable': questCard.claimable }"
        :aria-label="t('home.questTracker.aria', { name: questCard.name })"
        @click="ui.openStandalonePanel('quest')"
      >
        <h3>{{ t('dongFu.nav.quest') }} <span>›</span></h3>
        <p>{{ questCard.name }}</p>
        <span>{{ questCard.detail }}</span>
        <div class="home-design-progress"><i :style="{ width: `${questCard.percent}%` }" /></div>
      </button>
      <aside class="home-navigation-surface" data-df-ui @transitionend="onRailTransitionEnd">
        <img class="home-navigation-backing" :src="navBackingUrl" alt="">
        <nav class="home-independent-navigation">
          <button
            v-for="id in NAV_ITEMS"
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
        <button
          v-if="!railCollapsed"
          class="home-navigation-collapse"
          type="button"
          :aria-label="t('dongFu.railClose')"
          :aria-expanded="true"
          @click.stop="toggleRail()"
        >«</button>
      </aside>
      <img v-if="surfaceOpen" class="home-navigation-landscape-seam" :src="navSeamUrl" alt="">
      <button
        v-if="railCollapsed && railIndicator"
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
        :open="boardOpen"
        @toggle="boardOpen = !boardOpen"
        @action="onWheelAction"
      />
      <AutoFarmIndicator />
      <div class="df-notice" role="status" aria-live="polite" data-df-ui>{{ notice }}</div>
      <div class="pc-paper-scene__frame" aria-hidden="true" />
    </main>
  </SceneDesignCanvas>
  <FeedbackDialog :open="feedbackOpen" @close="feedbackOpen = false" />
</template>

<style scoped>
/* Same root contract as the fidelity scene: the scaled 1440x810 space,
   the CSS vars the regions read, and the button resets. */
.df-scene { --df-gold: #c9a761; --df-gold-light: #ebd094; --df-ivory: #f1e6c5; position: relative; width: 100%; height: 100%; overflow: hidden; color: var(--df-ivory); font-family: var(--font-display, Georgia, serif); }
.df-scene :deep(*) { box-sizing: border-box; }
.df-scene :deep(button) { font-family: inherit; font-weight: 400; }
.df-scene :deep(button:focus-visible) { outline: 2px solid #fff1b8; outline-offset: 5px; }

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
.home-independent-navigation img { position:absolute;left:43px;width:35px;height:35px;object-fit:contain; }
.home-independent-navigation button>span { margin-left:84px; }
.home-independent-navigation button::before { content:"";position:absolute;inset:0;z-index:-1;background:var(--home-nav-art) center/contain no-repeat; }
.home-independent-navigation button.locked { filter:grayscale(1);opacity:.48;cursor:default; }

/* ------ mock-verbatim: top chrome ------------------------------------ */
.home-design-profile { position:absolute;left:32px;top:14px;display:flex;align-items:center;gap:25px; }
.home-design-avatar { width:95px;height:95px;border:4px double #b28a43;border-radius:50%;background:#f1dfbb;display:grid;place-items:center; }
.home-design-avatar img { width:75px;height:75px;object-fit:contain; }
.home-design-profile h2 { font-size:25px;margin:0 0 8px;color:#251907; }
.home-design-profile p { margin:0;font-size:17px;display:flex;align-items:center;gap:15px;color:#4c3a21; }
.home-design-progress { display:inline-block;width:145px;height:8px;background:#2b2a20;border:1px solid #aa8040;border-radius:8px;overflow:hidden; }
.home-design-progress i { display:block;height:100%;background:#d6a852; }
.home-design-currencies { position:absolute;left:682px;top:14px;display:flex;gap:12px; }
.home-design-currencies .pc-paper-button { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 10px;min-height:38px;font-size:17px;min-width:148px; }
.home-design-currencies img { width:28px;height:28px;object-fit:contain; }
.home-design-quest { position:absolute;right:30px;top:85px;width:245px;padding:14px 18px 20px;background:#f9edd5df;border:3px double #a67c34;color:#2b2113;font-family:inherit;text-align:left;cursor:pointer; }
.home-design-quest h3 { margin:-14px -18px 17px;padding:10px 16px;background:#28271f;color:#f1dfb9;font-size:22px; }
.home-design-quest h3 span { float:right; }
.home-design-quest p { margin:0 0 13px;font-size:17px; }
.home-design-quest>span { display:block;text-align:right; }
.home-design-quest .home-design-progress { width:100%;margin-top:7px; }
.home-design-quest.is-claimable { box-shadow:0 0 14px #d9a93f; }

/* Thien Co Bang parks below the quest card while it awaits its
   redesign - the old top-right slot now belongs to the rail seam. */
.df-scene :deep(.df-board) { top: 290px; right: 30px; width: 245px; }
.df-scene :deep(.df-board__heading) { font-size: 20px; }

/* Floating chrome hidden while an overlay surface owns the screen. */
.df-scene--covered :deep(.df-board),
.df-scene--covered :deep(.df-notice) { display: none; }
.df-notice { position:absolute;top:110px;left:420px;color:#392e1d;text-shadow:0 1px #fff1d7;background:#f4e8cfcc; }
.df-notice:empty { display:none; }
</style>
