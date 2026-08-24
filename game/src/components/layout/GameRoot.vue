<script setup lang="ts">
import { computed } from 'vue'
import MainScene from '../game/MainScene.vue'
import CombatSceneOverlay from '../game/combat/CombatSceneOverlay.vue'
import TribulationSceneOverlay from '../game/tribulation/TribulationSceneOverlay.vue'
import HomeBuildingIcons from '../game/HomeBuildingIcons.vue'
import DongFuTopBar from './DongFuTopBar.vue'
import BottomBar from './BottomBar.vue'
import LeftPanel from './LeftPanel.vue'
import SkillPathPanel from '../panels/SkillPathPanel.vue'
import TechniquePanel from '../panels/TechniquePanel.vue'
import RealmPassivePanel from '../panels/RealmPassivePanel.vue'
import LuyenThePanel from '../panels/LuyenThePanel.vue'
import QuanKhiPanel from '../panels/QuanKhiPanel.vue'
import NavMenuOverlay from './NavMenuOverlay.vue'
import Tooltip from '../common/Tooltip.vue'
import ToastContainer from '../common/ToastContainer.vue'
import WorldAnnouncementOverlay from '../common/WorldAnnouncementOverlay.vue'
import OfflineSummaryModal from '../common/OfflineSummaryModal.vue'
import BreakthroughRequirementPanel from '../common/BreakthroughRequirementPanel.vue'
import TutorialOverlay from '../common/TutorialOverlay.vue'
import { useOfflineSummaryStore } from '@/stores/offlineSummary'
import { useUiStore } from '@/stores/ui'
import { useCombatSceneActive } from '@/composables/useCombatSceneActive'

const offlineSummary = useOfflineSummaryStore()

// WS1 Responsive foundation (2026-08-24) — BỎ frame 2560x1440 +
// transform:scale() toàn game (trước đây cửa sổ 1280x800 bị co đúng
// 50%: icon/chữ/vùng bấm đều nhỏ bằng nửa kích thước thiết kế). Giờ
// .game-root chiếm TRỰC TIẾP viewport; top/bottom bar dùng chiều cao
// px thực theo clamp() (--top-bar-h/--bottom-bar-h trong theme.css).
// Canvas Phaser tự thích ứng theo container (ResizeObserver trong
// PhaserCanvas.vue + các scene đã handle 'resize'); khoảng reserved
// combat được đồng bộ qua game/support/combatInsets.ts.
// DesignFrame.ts vẫn giữ hằng số cho các consumer TS thuần khác
// (SlotSizes/BagGrid) nhưng KHÔNG còn quyết định kích thước DOM chrome.
const ui = useUiStore()

// Combat UI Redesign — Combat Scene chiếm TOÀN màn hình, thay hẳn
// chrome Động Phủ (LeftPanel/TopBar/BottomBar/HomeBuildingIcons) —
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
  ui.leftPanelMode = null
}
</script>

<template>
  <div class="game-viewport">
    <div class="game-root">
      <MainScene @click="closeSidePanels" />

      <template v-if="!isFullSceneActive">
        <HomeBuildingIcons />

        <LeftPanel class="game-root__left-panel" />

        <!-- Kỹ Năng/Tâm Pháp (2026-08-20) — tách khỏi LeftPanel thành
             overlay toàn màn hình độc lập (ui.standalonePanel), cùng
             pattern BreakthroughRequirementPanel bên dưới. Vẫn nằm
             trong khối chrome Động Phủ này (ẩn hẳn lúc combat như
             LeftPanel) vì đều là "trang chức năng" của Động Phủ. -->
        <SkillPathPanel />

        <TechniquePanel />

        <RealmPassivePanel />

        <LuyenThePanel />

        <QuanKhiPanel />

        <DongFuTopBar class="game-root__top-bar" />

        <BottomBar class="game-root__bottom-bar" />
      </template>

      <CombatSceneOverlay v-if="isCombatSceneActive" />
      <TribulationSceneOverlay v-else-if="ui.isTribulationSceneActive" />

      <NavMenuOverlay />

      <Tooltip />

      <ToastContainer />

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
  top: var(--top-bar-h);
  bottom: var(--bottom-bar-h);
  left: 0;
  /* WS3 — drawer responsive thay vì % cứng của frame cũ: đủ rộng để
     nội dung panel thở ở cửa sổ hẹp (1280px -> ~384px), không phình
     vô hạn ở màn lớn (max 480px). */
  width: clamp(360px, 30vw, 480px);
  /* HomeBuildingIcons.vue đặt z-index:5 cho icon building rải trên
     viền trên khung cảnh — panel trái PHẢI luôn nổi trên icon đó
     (icon nằm ngoài tầm layout width panel nên đè trực tiếp lên nội
     dung panel, kể cả nút "Bắt Đầu Tu Luyện" trong Động Phủ). */
  z-index: 10;
}

.game-root__top-bar {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: var(--top-bar-h);
  /* Nổi TRÊN cả LeftPanel (z-index:10) — Menu/Settings/Tài nguyên
     phải luôn bấm được kể cả khi 1 panel chức năng đang mở. */
  z-index: 20;
}

.game-root__bottom-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--bottom-bar-h);
}
</style>
