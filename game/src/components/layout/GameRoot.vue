<script setup lang="ts">
import { computed } from 'vue'
import MainScene from '../game/MainScene.vue'
import CombatSceneOverlay from '../game/combat/CombatSceneOverlay.vue'
import TribulationSceneOverlay from '../game/tribulation/TribulationSceneOverlay.vue'
import HomeBuildingIcons from '../game/HomeBuildingIcons.vue'
import HomeResourceStrip from '../game/HomeResourceStrip.vue'
import DongFuCommandWheel from '../game/DongFuCommandWheel.vue'
import BuildingDetailPopover from '../game/BuildingDetailPopover.vue'
import LeftPanel from './LeftPanel.vue'
import RightPanel from './RightPanel.vue'
import FunctionOverlayPanel from './FunctionOverlayPanel.vue'
import SkillPathPanel from '../panels/SkillPathPanel.vue'
import TechniquePanel from '../panels/TechniquePanel.vue'
import RealmPanel from '../panels/RealmPanel.vue'
import LuyenThePanel from '../panels/LuyenThePanel.vue'
import QuanKhiPanel from '../panels/QuanKhiPanel.vue'
import QuestPanel from '../panels/QuestPanel.vue'
import ArtifactPanel from '../panels/ArtifactPanel.vue'
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
// reserved combat được đồng bộ qua game/support/combatInsets.ts.
const ui = useUiStore()

// Combat UI Redesign — Combat Scene chiếm TOÀN màn hình, thay hẳn
// chrome Động Phủ (LeftPanel/HomeBuildingIcons/CommandWheel) —
// MainScene (Phaser canvas) vẫn LUÔN mount (tự chuyển scene nội bộ,
// xem MainScene.vue), chỉ DOM chrome xung quanh nó ẩn/hiện theo cờ này.
const isCombatSceneActive = useCombatSceneActive()
const isFullSceneActive = computed(() => isCombatSceneActive.value || ui.isTribulationSceneActive)

// Bấm khoảng trống giữa màn hình (MainScene — cảnh Phaser, không phải
// panel/icon/popover nào) tự đóng panel chức năng đang mở. Gắn THẲNG
// lên <MainScene> (không phải 1 lớp overlay riêng) — MainScene và các
// panel/icon là các phần tử ANH EM cùng cấp (xem cây trong template
// dưới), nên click trúng panel/building-icon/popover sẽ KHÔNG bao giờ
// bubble tới handler này (chúng nằm ở nhánh DOM khác, không phải con
// của MainScene) — chỉ click trúng MainScene thật (vùng trống) mới
// kích hoạt, không cần .stop ở bất kỳ đâu khác.
function closeSidePanels() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <div class="game-viewport">
    <div class="game-root">
      <MainScene @click="closeSidePanels" />

      <template v-if="!isFullSceneActive">
        <HomeResourceStrip />
        <HomeBuildingIcons />

        <!-- Shared popover authority (plan Workstream C) — CHỈ MỘT
             BuildingDetailPopover cho CẢ hotspot lẫn command wheel,
             điều khiển qua ui.activeBuildingPopoverId. -->
        <div v-if="ui.activeBuildingPopoverId" class="game-root__building-popover-layer">
          <BuildingDetailPopover :building-id="ui.activeBuildingPopoverId" />
        </div>

        <LeftPanel class="game-root__left-panel" />
        <RightPanel />
        <FunctionOverlayPanel />

        <!-- Kỹ Năng/Tâm Pháp (2026-08-20) — tách khỏi LeftPanel thành
             overlay toàn màn hình độc lập (ui.standalonePanel), cùng
             pattern BreakthroughRequirementPanel bên dưới. -->
        <SkillPathPanel />

        <TechniquePanel />

        <RealmPanel />

        <LuyenThePanel />

        <QuanKhiPanel />

        <QuestPanel />

        <ArtifactPanel />

        <!-- Command wheel nhiều tầng — trigger là nhân vật tu luyện
             giữa Động Phủ (DongFuScene.vue). -->
        <DongFuCommandWheel />
      </template>

      <CombatSceneOverlay v-if="isCombatSceneActive" />
      <TribulationSceneOverlay v-else-if="ui.isTribulationSceneActive" />

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
