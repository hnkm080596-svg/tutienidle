<script setup lang="ts">
import { computed } from 'vue'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import BuildingPanelHeader from '@/components/panels/BuildingPanelHeader.vue'
import ProductionPanel from '@/components/panels/ProductionPanel.vue'
import SettingsPanel from '@/components/panels/SettingsPanel.vue'
import PillRoomPanel from '@/components/panels/PillRoomPanel.vue'
import EquipmentHallPanel from '@/components/panels/EquipmentHallPanel.vue'
import ScripturePavilionPanel from '@/components/panels/ScripturePavilionPanel.vue'
import StageSelectPanel from '@/components/panels/StageSelectPanel.vue'
import SpiritSpringPanel from '@/components/panels/SpiritSpringPanel.vue'
import { useUiStore, type LeftPanelMode } from '@/stores/ui'

const ui = useUiStore()

type FunctionMode = Exclude<LeftPanelMode, 'character' | 'inventory' | null>

const TITLES: Record<FunctionMode, string> = {
  exploration: 'Sản Xuất',
  settings: 'Cài Đặt',
  equipment_hall: 'Khí Đường',
  pill_room: 'Đan Phòng',
  spirit_spring: 'Linh Tuyền',
  scripture_pavilion: 'Tàng Kinh Các',
  stage_select: 'Địa Giới',
}

const BUILDINGS: Partial<Record<FunctionMode, string>> = {
  exploration: 'gathering_outpost',
  equipment_hall: 'equipment_hall',
  pill_room: 'pill_room',
  spirit_spring: 'spirit_spring',
  stage_select: 'teleport_array',
}

const mode = computed<FunctionMode | null>(() => {
  const value = ui.leftPanelMode
  return value && value !== 'character' && value !== 'inventory' ? value : null
})

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <OverlayPanel
    :open="mode !== null"
    :title="mode ? TITLES[mode] : ''"
    width="min(1120px, 94vw)"
    height="min(820px, 92vh)"
    @close="close"
  >
    <div v-if="mode" class="function-overlay">
      <BuildingPanelHeader v-if="BUILDINGS[mode]" :building-id="BUILDINGS[mode]!" />
      <ProductionPanel v-if="mode === 'exploration'" />
      <SettingsPanel v-else-if="mode === 'settings'" />
      <PillRoomPanel v-else-if="mode === 'pill_room'" />
      <EquipmentHallPanel v-else-if="mode === 'equipment_hall'" />
      <SpiritSpringPanel v-else-if="mode === 'spirit_spring'" />
      <ScripturePavilionPanel v-else-if="mode === 'scripture_pavilion'" />
      <StageSelectPanel v-else-if="mode === 'stage_select'" />
    </div>
  </OverlayPanel>
</template>

<style scoped>
.function-overlay { height: 100%; display: flex; flex-direction: column; }
</style>
