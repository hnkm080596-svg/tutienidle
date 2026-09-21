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
import BreakthroughRequirementPanel from '../common/BreakthroughRequirementPanel.vue'
import TutorialOverlay from '../common/TutorialOverlay.vue'
import { useOfflineSummaryStore } from '@/stores/offlineSummary'
import { useUiStore } from '@/stores/ui'
import { useCombatSceneActive } from '@/composables/useCombatSceneActive'

const offlineSummary = useOfflineSummaryStore()

// WS1 Responsive foundation (2026-08-24) — BỎ frame 2560x1440 +
// transform:scale() toàn game. Command-wheel plan (2026-08-26) — bỏ
// hẳn top/bottom action bar và NavMenuOverlay: Động Phủ dùng TOÀN BỘ
// viewport khi không combat/Độ Kiếp; mọi entry chức năng đi qua command
// wheel (trigger = nhân vật tu luyện giữa màn hình) hoặc hotspot
// building. Canvas Phaser tự thích ứng theo container (ResizeObserver
// trong PhaserCanvas.vue + các scene đã handle 'resize'); khoảng
// reserved combat được đồng bộ qua presentation/geometry/combatInsets.ts.
const ui = useUiStore()

// Combat UI Redesign — Combat Scene chiếm TOÀN màn hình, thay hẳn
// chrome Động Phủ (LeftPanel/CommandWheel) — HomeBuildingIcons được render
// trong DongFuScene để art công trình nằm đúng phía sau nhân vật.
// MainScene (Phaser canvas) vẫn LUÔN mount (tự chuyển scene nội bộ,
// xem MainScene.vue), chỉ DOM chrome xung quanh nó ẩn/hiện theo cờ này.
const routeAdapter = inject(VUE_ROUTE_ADAPTER_KEY, null)

// Scene visibility follows the coordinator route — the single authority for
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

// Bấm khoảng trống giữa màn hình (MainScene — cảnh Phaser, không phải
// panel/icon/popover nào) tự đóng panel chức năng đang mở. Gắn THẲNG
// lên <MainScene> (không phải 1 lớp overlay riêng). Panel/popover vẫn là
// sibling; building hotspot nằm trong MainScene và tự chặn bubble. Vì vậy
// chỉ click trúng vùng cảnh trống mới kích hoạt handler này.
function closeSidePanels() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <div class="game-viewport">
    <div class="game-root">
      <MainScene @click="closeSidePanels" />

      <template v-if="!isFullSceneActive">
        <!-- Shared popover authority (plan Workstream C) — CHỈ MỘT
             BuildingDetailPopover cho CẢ hotspot lẫn command wheel,
             điều khiển qua ui.activeBuildingPopoverId. -->
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

        <!-- Command wheel nhiều tầng — trigger là nhân vật tu luyện
             giữa Động Phủ (DongFuScene.vue). -->
        <DongFuCommandWheel />

        <!-- Armed auto-farm holds the single StageManager slot (no combat
             can mount) — the indicator lives in home chrome, not the
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

.game-root__left-panel {
  position: absolute;
  /* Full-height overlay ở cạnh trái — không còn chừa top/bottom bar. */
  inset: 0 auto 0 0;
  /* WS3 — drawer responsive thay vì % cứng của frame cũ: đủ rộng để
     nội dung panel thở ở cửa sổ hẹp (1280px -> ~384px), không phình
     vô hạn ở màn lớn (max 480px). */
  width: clamp(360px, 30vw, 480px);
  /* Nổi trên hotspot (5)/command wheel (8) — panel chức năng mở thì
     nội dung phải bấm được trọn vẹn. */
  z-index: 10;
  container-type: inline-size;
  container-name: left-panel;
}

/* Workstream G (gameplay-ui-feedback-responsive-cleanup-plan.md §10) —
   viewport rất hẹp (vd 800×600): clamp(360px,...) buộc panel chiếm gần
   1 nửa màn hình. Chuyển sang drawer gần/full width thay vì giữ trần
   360px cứng, vẫn chừa lối đóng (panel luôn có nút back/close riêng). */
@media (max-width: 900px) {
  .game-root__left-panel {
    /* Cả Left+Right cùng mở theo characterOverlayOpen - mỗi bên tối đa
       44vw để tổng không vuợt viewport (tránh chồng panel). Floor 260px
       (đợt 4 fit-refactor): dưới 620px drawer chiếm trọn màn hình. */
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
