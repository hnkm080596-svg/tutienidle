<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import EquipmentPaperdoll from '../panels/EquipmentPaperdoll.vue'
import CharacterPanel from '../panels/CharacterPanel.vue'
import InventoryPanel from '../panels/InventoryPanel.vue'
import ProductionPanel from '../panels/ProductionPanel.vue'
import SettingsPanel from '../panels/SettingsPanel.vue'
import PillRoomPanel from '../panels/PillRoomPanel.vue'
import EquipmentHallPanel from '../panels/EquipmentHallPanel.vue'
import ScripturePavilionPanel from '../panels/ScripturePavilionPanel.vue'
import StageSelectPanel from '../panels/StageSelectPanel.vue'
import BuildingPanelHeader from '../panels/BuildingPanelHeader.vue'
import SpiritSpringPanel from '../panels/SpiritSpringPanel.vue'
import type { LeftPanelMode } from '@/stores/ui'

const ui = useUiStore()

// Equipment cố định 30% chỉ hiện cho Hành Trang — 'crafting' (Tứ
// Nghệ cũ) đã xoá ở Home Hub Phase 8 (nội dung tab 'artifact' chuyển
// sang Khí Đường). UI redesign Step 9 (2026-08-20) — Khí Đường
// (EquipmentHallPanel.vue) đã bỏ hẳn paperdoll riêng của nó (thu gọn
// về thuần Luyện Khí), nên khối 30% NÀY (Hành Trang/'inventory') giờ
// là nơi DUY NHẤT hiện paperdoll bên ngoài Character header. Các trang
// còn lại chiếm TOÀN BỘ 100% panel.
const showsEquipment = computed(() => ui.leftPanelMode === 'inventory')

const BUILDING_ID_BY_PANEL: Partial<Record<Exclude<LeftPanelMode, null>, string>> = {
  equipment_hall: 'equipment_hall',
  pill_room: 'pill_room',
  stage_select: 'teleport_array',
  exploration: 'gathering_outpost',
  spirit_spring: 'spirit_spring',
}

const activeBuildingId = computed(() =>
  ui.leftPanelMode ? BUILDING_ID_BY_PANEL[ui.leftPanelMode] : undefined,
)
</script>

<template>
  <Transition name="panel-slide-left">
    <div v-if="ui.leftPanelMode" class="left-panel">
      <div v-if="showsEquipment" class="left-panel__equipment">
        <EquipmentPaperdoll />
      </div>

      <div class="left-panel__content" :class="{ 'left-panel__content--full': !showsEquipment }">
        <BuildingPanelHeader v-if="activeBuildingId" :building-id="activeBuildingId" />

        <div class="left-panel__view">
          <CharacterPanel v-if="ui.leftPanelMode === 'character'" />

          <InventoryPanel v-else-if="ui.leftPanelMode === 'inventory'" />

          <ProductionPanel v-else-if="ui.leftPanelMode === 'exploration'" />

          <StageSelectPanel v-else-if="ui.leftPanelMode === 'stage_select'" />

          <SettingsPanel v-else-if="ui.leftPanelMode === 'settings'" />

          <PillRoomPanel v-else-if="ui.leftPanelMode === 'pill_room'" />

          <EquipmentHallPanel v-else-if="ui.leftPanelMode === 'equipment_hall'" />

          <SpiritSpringPanel v-else-if="ui.leftPanelMode === 'spirit_spring'" />

          <ScripturePavilionPanel v-else-if="ui.leftPanelMode === 'scripture_pavilion'" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Vị trí/kích thước (position/top/left/width/bottom) do GameRoot.vue
   quyết định qua class truyền vào (.game-root__left-panel) — ở đây
   chỉ style hình thức, tránh 2 nơi cùng set position/height đè nhau.
   v-if trên chính div này (thay vì chỉ trên nội dung con) để cả khối
   panel (nền + border) cùng trượt vào/ra, không chỉ phần nội dung. */
.left-panel {
  /* KHÔNG set width/height:100% — vị trí/kích thước thật đã do
     .game-root__left-panel (position:absolute; top:0; bottom:72px)
     quyết định. height:100% ở đây từng đè lên bottom:72px (over-
     constrained, browser bỏ qua bottom) khiến panel cao tràn hết
     100vh, lấn xuống dưới cả bottom bar. */
  background: var(--ink-900);
  border-right: 1px solid var(--ink-line);
  box-shadow: var(--shadow-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Equipment CHỈ hiện cho Hành Trang/Tứ Nghệ, cố định 30% — phần còn
   lại (70%) là trang riêng của loại đó. 4 trang khác (Nhân Vật/Công
   Pháp/Thu Thập/Cài Đặt) không có khối này, content chiếm full 100%
   (xem .left-panel__content--full). */
.left-panel__equipment {
  flex: 0 0 30%;
  min-height: 0;
  border-bottom: 1px solid var(--ink-line);
}

.left-panel__content {
  flex: 1 1 70%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.left-panel__content--full {
  flex: 1 1 100%;
}

.left-panel__view {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.panel-slide-left-enter-active,
.panel-slide-left-leave-active {
  transition:
    transform 0.28s ease,
    filter 0.28s ease,
    opacity 0.28s ease;
}

.panel-slide-left-enter-from,
.panel-slide-left-leave-to {
  transform: translateX(-100%);
  filter: blur(12px);
  opacity: 0;
}

.panel-slide-left-enter-to,
.panel-slide-left-leave-from {
  transform: translateX(0);
  filter: blur(0);
  opacity: 1;
}
</style>
