<script setup lang="ts">
import { computed, defineAsyncComponent, inject, reactive, watch } from 'vue'
import type { StandalonePanel } from '@/presentation/contracts/panelIds'
import MainScene from '../game/MainScene.vue'
import RouteMount from '../game/RouteMount.vue'
import CombatSceneOverlay from '../game/combat/CombatSceneOverlay.vue'
import TribulationSceneOverlay from '../game/tribulation/TribulationSceneOverlay.vue'
import { VUE_ROUTE_ADAPTER_KEY } from '@/presentation/PresentationContracts'
import BuildingDetailPopover from '../game/BuildingDetailPopover.vue'
import LeftPanel from './LeftPanel.vue'
import FunctionOverlayPanel from './FunctionOverlayPanel.vue'
// Standalone overlay panels load lazily: the module is fetched on first
// open (v-if below), then the component stays mounted so OverlayPanel's
// close transition and panel-internal state keep working exactly as with
// the old static imports.
const SkillPathPanel = defineAsyncComponent(() => import('../panels/SkillPathPanel.vue'))
const RealmPanel = defineAsyncComponent(() => import('../panels/RealmPanel.vue'))
const QuanKhiPanel = defineAsyncComponent(() => import('../panels/QuanKhiPanel.vue'))
const QuestPanel = defineAsyncComponent(() => import('../panels/QuestPanel.vue'))
const ArtifactPanel = defineAsyncComponent(() => import('../panels/ArtifactPanel.vue'))
const TranPhapPanel = defineAsyncComponent(() => import('../panels/TranPhapPanel.vue'))
const CompanionPanel = defineAsyncComponent(() => import('../panels/CompanionPanel.vue'))
const TechniquePanel = defineAsyncComponent(() => import('../panels/TechniquePanel.vue'))
const BodyPanel = defineAsyncComponent(() => import('../panels/BodyPanel.vue'))
import Tooltip from '../common/Tooltip.vue'
import ToastContainer from '../common/ToastContainer.vue'
import ActionFeedbackLog from '../common/ActionFeedbackLog.vue'
import WorldAnnouncementOverlay from '../common/WorldAnnouncementOverlay.vue'
import OfflineSummaryModal from '../common/OfflineSummaryModal.vue'
import TalentEntitlementModal from '../common/TalentEntitlementModal.vue'
import BreakthroughRequirementPanel from '../common/BreakthroughRequirementPanel.vue'
import TutorialOverlay from '../common/TutorialOverlay.vue'
import { useOfflineSummaryStore } from '@/stores/offlineSummary'
import { useUiStore } from '@/stores/ui'
import { useCombatSceneActive } from '@/composables/useCombatSceneActive'
import { betaAdmittedBuildingPopoverId, isBetaStandalonePanel } from '@/core/betaScopeSurface'

const offlineSummary = useOfflineSummaryStore()

// WS1 Responsive foundation (2026-08-24) - BO frame 2560x1440 +
// transform:scale() toan game. Command-wheel plan (2026-08-26) - bo
// han top/bottom action bar va NavMenuOverlay: Dong Phu dung TOAN BO
// viewport khi khong combat/Do Kiep; moi entry chuc nang di qua command
// wheel (trigger = nhan vat tu luyen giua man hinh) hoac hotspot
// building. Canvas Phaser tu thich ung theo container (ResizeObserver
// trong PhaserCanvas.vue + cac scene da handle 'resize'); khoang
// reserved combat duoc dong bo qua presentation/geometry/combatInsets.ts.
const ui = useUiStore()

// Combat UI Redesign - Combat Scene chiem TOAN man hinh, thay han
// chrome Dong Phu (LeftPanel/CommandWheel) - HomeBuildingIcons duoc render
// trong DongFuScene de art cong trinh nam dung phia sau nhan vat.
// MainScene (Phaser canvas) van LUON mount (tu chuyen scene noi bo,
// xem MainScene.vue), chi DOM chrome xung quanh no an/hien theo co nay.
const routeAdapter = inject(VUE_ROUTE_ADAPTER_KEY, null)

// Scene visibility follows the coordinator route - the single authority for
// which game screen is mounted (the ui-store fallback flags were retired
// with the R12 cleanup).
const isCombatSceneActive = useCombatSceneActive()
const isTribulationSceneActive = computed(
  () => routeAdapter?.activeRoute.value === 'tribulation',
)
const isFullSceneActive = computed(
  () => isCombatSceneActive.value || isTribulationSceneActive.value,
)

// Lazy-once mount set: a standalone panel mounts (and its chunk loads) the
// first time it is opened, then stays mounted for the session so the close
// transition and component state behave identically to static imports.
const mountedStandalone = reactive(new Set<Exclude<StandalonePanel, null>>())
watch(
  () => ui.standalonePanel,
  (panel) => {
    // BETA SCOPE LOCK v2 (Phase-6): the mount seam is the deep-link
    // chokepoint - a scope-hidden panel can never mount even when a
    // caller bypasses ui.openStandalonePanel and assigns the state
    // field directly (e.g. the tribulation outcome seam).
    if (panel && isBetaStandalonePanel(panel)) mountedStandalone.add(panel)
  },
  { immediate: true },
)

// BETA SCOPE LOCK: the popover mount seam carries the same chokepoint
// defense as the standalone-panel watcher - a scope-hidden building's
// card never renders even when ui.activeBuildingPopoverId is assigned
// directly (e.g. by a surface that skipped openBuildingPopover).
const admittedBuildingPopoverId = computed(() =>
  betaAdmittedBuildingPopoverId(ui.activeBuildingPopoverId),
)

/** Which route this Vue tree is currently standing in for (mount witness). */
const mountedGameRoute = computed<'home' | 'combat' | 'tribulation'>(() => {
  const route = routeAdapter?.activeRoute.value
  return route === 'combat' || route === 'tribulation' ? route : 'home'
})

// Bam khoang trong giua man hinh (MainScene - canh Phaser, khong phai
// panel/icon/popover nao) tu dong panel chuc nang dang mo. Gan THANG
// len <MainScene> (khong phai 1 lop overlay rieng). Panel/popover van la
// sibling; building hotspot nam trong MainScene va tu chan bubble. Vi vay
// chi click trung vung canh trong moi kich hoat handler nay.
function closeSidePanels() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <div class="game-viewport">
    <div class="game-root">
      <MainScene @click="closeSidePanels" />

      <template v-if="!isFullSceneActive">
        <!-- Shared popover authority (plan Workstream C) - CHI MOT
             BuildingDetailPopover cho CA hotspot lan command wheel,
             dieu khien qua ui.activeBuildingPopoverId. -->
        <div v-if="admittedBuildingPopoverId" class="game-root__building-popover-layer">
          <BuildingDetailPopover :building-id="admittedBuildingPopoverId" />
        </div>

        <!-- Spec SS11/SS12 home chrome (top bar, Thien Co rail, quest
             tracker, command wheel) moved INSIDE DongFuStage - the
             approved dong-fu-v2 fidelity surface renders all of it in
             the scaled design canvas above the vista. -->

        <!-- LeftPanel hosts the imperial scroll itself; the old
             drawer-width wrapper is gone (the scene owns its overlay). -->
        <LeftPanel />
        <FunctionOverlayPanel />

        <!-- Ky Nang (2026-08-20) - tach khoi LeftPanel thanh overlay
             toan man hinh doc lap (ui.standalonePanel), cung pattern
             BreakthroughRequirementPanel ben duoi. P7-M7: Tam Phap +
             Luyen The da gop vao SkillPathPanel/RealmPanel. -->
        <SkillPathPanel v-if="mountedStandalone.has('skill')" />

        <RealmPanel v-if="mountedStandalone.has('realm')" />

        <QuanKhiPanel v-if="mountedStandalone.has('quan_khi')" />

        <QuestPanel v-if="mountedStandalone.has('quest')" />

        <ArtifactPanel v-if="mountedStandalone.has('artifact')" />

        <TranPhapPanel v-if="mountedStandalone.has('tran_phap')" />

        <CompanionPanel v-if="mountedStandalone.has('companion')" />

        <!-- Huyen Kim scenes 06/08 - Tam Phap + Dao The as dedicated
             imperial scroll scenes (extracted out of Skill/Realm). -->
        <TechniquePanel v-if="mountedStandalone.has('technique')" />

        <BodyPanel v-if="mountedStandalone.has('body')" />
      </template>

      <CombatSceneOverlay v-if="isCombatSceneActive" />
      <TribulationSceneOverlay v-else-if="isTribulationSceneActive" />

      <Tooltip />

      <ToastContainer />

      <ActionFeedbackLog />

      <WorldAnnouncementOverlay />

      <OfflineSummaryModal
        v-if="offlineSummary.data"
        :elapsed-seconds="offlineSummary.data.elapsedSeconds"
        :cultivation="offlineSummary.data.cultivation"
        @close="offlineSummary.clear()"
      />

      <!-- M-F-TALENT - the mandatory breakthrough talent decision. Lives
           OUTSIDE the !isFullSceneActive block (it can be pending while
           the tribulation scene still owns the route); reads the
           persisted record and renders nothing when none is pending. -->
      <TalentEntitlementModal />

      <BreakthroughRequirementPanel />

      <TutorialOverlay />

      <RouteMount :route="mountedGameRoute" />
    </div>
  </div>
</template>

<style scoped>
.game-viewport {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--ink-950);
}

.game-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--ink-950);
}

.game-root__building-popover-layer {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.game-root__building-popover-layer :deep(.building-popover) {
  pointer-events: auto;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.68);
}
</style>
