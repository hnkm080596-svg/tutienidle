<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
import { DESIGN_WIDTH, DESIGN_HEIGHT, BOTTOM_BAR_HEIGHT, TOP_BAR_HEIGHT, LEFT_PANEL_WIDTH_PERCENT } from '@/core/ui/DesignFrame'

// Frame thiết kế cố định 16:9 — mọi layout con (% panel, bottom bar...)
// tính theo kích thước NÀY chứ không phải theo viewport thật, nên
// luôn giữ đúng tỉ lệ dù cửa sổ bị kéo sang hình dạng khác. Cả khối
// .game-root được scale bằng CSS transform để vừa khít màn hình
// (letterbox 2 bên/trên-dưới bù phần thừa) — nhờ vậy toàn bộ panel/
// bottom bar (frame con) tự động nhỏ lại theo đúng tỉ lệ frame mẹ.
// DESIGN_WIDTH/HEIGHT/BOTTOM_BAR_HEIGHT/LEFT_PANEL_WIDTH_PERCENT import
// từ DesignFrame.ts — nguồn DUY NHẤT, BagGrid/EquipmentPaperdoll cũng
// tính kích thước ô dựa trên đúng các hằng số này (xem SlotSizes.ts).
const designWidthPx = `${DESIGN_WIDTH}px`
const designHeightPx = `${DESIGN_HEIGHT}px`
const bottomBarHeightPx = `${BOTTOM_BAR_HEIGHT}px`
const topBarHeightPx = `${TOP_BAR_HEIGHT}px`
const leftPanelWidthPercent = `${LEFT_PANEL_WIDTH_PERCENT * 100}%`

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

const scale = ref(1)

function updateScale() {
  scale.value = Math.min(
    window.innerWidth / DESIGN_WIDTH,
    window.innerHeight / DESIGN_HEIGHT,
  )
}

onMounted(() => {
  updateScale()

  window.addEventListener('resize', updateScale)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScale)
})
</script>

<template>
  <div class="game-viewport">
    <div class="game-root" :style="{ transform: `scale(${scale})` }">
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
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--ink-950);
}

.game-root {
  position: relative;
  flex: 0 0 auto;
  width: v-bind(designWidthPx);
  height: v-bind(designHeightPx);
  overflow: hidden;
  background: var(--ink-950);
  transform-origin: center center;
}

.game-root__left-panel {
  position: absolute;
  top: v-bind(topBarHeightPx);
  bottom: v-bind(bottomBarHeightPx);
  left: 0;
  width: v-bind(leftPanelWidthPercent);
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
  height: v-bind(topBarHeightPx);
  /* Nổi TRÊN cả LeftPanel (z-index:10) — Menu/Settings/Tài nguyên
     phải luôn bấm được kể cả khi 1 panel chức năng đang mở. */
  z-index: 20;
}

.game-root__bottom-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: v-bind(bottomBarHeightPx);
}
</style>
