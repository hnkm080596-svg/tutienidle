<script setup lang="ts">
import { computed, defineAsyncComponent, inject, reactive, watch } from 'vue'
import type { StandalonePanel } from '@/presentation/contracts/panelIds'
import MainScene from '../game/MainScene.vue'
import RouteMount from '../game/RouteMount.vue'
import CombatSceneOverlay from '../game/combat/CombatSceneOverlay.vue'
import TribulationSceneOverlay from '../game/tribulation/TribulationSceneOverlay.vue'
import { VUE_ROUTE_ADAPTER_KEY } from '@/presentation/PresentationContracts'
import DongFuCommandWheel from '../game/DongFuCommandWheel.vue'
import AutoFarmIndicator from '../game/AutoFarmIndicator.vue'
import BuildingDetailPopover from '../game/BuildingDetailPopover.vue'
import LeftPanel from './LeftPanel.vue'
import RightPanel from './RightPanel.vue'
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
    if (panel) mountedStandalone.add(panel)
  },
  { immediate: true },
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
        <div v-if="ui.activeBuildingPopoverId" class="game-root__building-popover-layer">
          <BuildingDetailPopover :building-id="ui.activeBuildingPopoverId" />
        </div>

        <LeftPanel class="game-root__left-panel" />
        <RightPanel />
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

        <!-- Command wheel nhieu tang - trigger la nhan vat tu luyen
             giua dong Phu (DongFuScene.vue). -->
        <DongFuCommandWheel />

        <!-- Armed auto-farm holds the single StageManager slot (no combat
             can mount) - the indicator lives in home chrome, not the
             combat HUD, so the stop path is always reachable (T1-6). -->
        <AutoFarmIndicator />
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
  background: var(--sys-bg-0, var(--ink-950));
}

.game-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--sys-bg-0, var(--ink-950));
}

.game-root__left-panel {
  position: absolute;
  /* Full-height overlay o canh trai - khong con chua top/bottom bar. */
  inset: 0 auto 0 0;
  /* WS3 - drawer responsive thay vi % cung cua frame cu: du rong de
     noi dung panel tho o cua so hep (1280px -> ~384px), khong phinh
     vo han o man lon (max 480px). */
  width: clamp(360px, 30vw, 480px);
  /* Noi tren hotspot (5)/command wheel (8) - panel chuc nang mo thi
     noi dung phai bam duoc tron ven. */
  z-index: 10;
  container-type: inline-size;
  container-name: left-panel;
}

/* Workstream G (gameplay-ui-feedback-responsive-cleanup-plan.md S10) -
   viewport rat hep (vd 800x600): clamp(360px,...) buoc panel chiem gan
   1 nua man hinh. Chuyen sang drawer gan/full width thay vi giu tran
   360px cung, van chua loi dong (panel luon co nut back/close rieng). */
@media (max-width: 900px) {
  .game-root__left-panel {
    /* Ca Left+Right cung mo theo characterOverlayOpen - moi ben toi da
       44vw de tong khong vuot viewport (tranh chong panel). Floor 260px
       (Dot 4 fit-refactor): duoi 620px drawer chiem tron man hinh. */
    width: max(min(44vw, 400px), 260px);
  }
}

@media (max-width: 620px) {
  .game-root__left-panel {
    width: 100%;
  }
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
