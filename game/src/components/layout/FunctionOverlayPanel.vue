<script setup lang="ts">
import { computed } from 'vue'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import GameButton from '@/components/common/GameButton.vue'
import { useBuildingHeaderState } from '@/composables/useBuildingHeaderState'
import ProductionPanel from '@/components/panels/ProductionPanel.vue'
import SettingsPanel from '@/components/panels/SettingsPanel.vue'
import PillRoomPanel from '@/components/panels/PillRoomPanel.vue'
import EquipmentHallPanel from '@/components/panels/EquipmentHallPanel.vue'
import ScripturePavilionPanel from '@/components/panels/ScripturePavilionPanel.vue'
import StageSelectPanel from '@/components/panels/StageSelectPanel.vue'
import SpiritSpringPanel from '@/components/panels/SpiritSpringPanel.vue'
import VendorPanel from '@/components/panels/VendorPanel.vue'
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
  vendor: 'Ký Bảo Các',
}

const BUILDINGS: Partial<Record<FunctionMode, string>> = {
  exploration: 'gathering_outpost',
  equipment_hall: 'equipment_hall',
  pill_room: 'pill_room',
  spirit_spring: 'spirit_spring',
  stage_select: 'teleport_array',
  vendor: 'vendor',
}

const mode = computed<FunctionMode | null>(() => {
  const value = ui.leftPanelMode
  return value && value !== 'character' && value !== 'inventory' ? value : null
})

const buildingId = computed(() => (mode.value ? BUILDINGS[mode.value] : undefined))

const header = useBuildingHeaderState(buildingId)

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
    data-testid="function-overlay-panel"
    @close="close"
  >
    <!-- Header building GỘP LÀM 1 (2026-08-30, bug report: 2 dải trùng
         tên/cấp) — ảnh + Tên + Cấp bơm thẳng vào title bar OverlayPanel,
         nút Nâng cấp bơm vào header-actions cùng dải, KHÔNG còn dải phụ
         riêng bên dưới. -->
    <template v-if="header.template.value" #heading>
      <div class="building-heading">
        <img class="building-heading__art" :src="header.artPath.value" alt="" />
        <div class="building-heading__text">
          <p class="building-heading__name">{{ header.template.value.name }}</p>
          <small class="building-heading__level">Cấp {{ header.instance.value?.level }} / {{ header.template.value.maxLevel }}</small>
        </div>
      </div>
    </template>

    <template v-if="header.template.value && header.instance.value" #header-actions>
      <div class="building-heading__upgrade-area">
        <GameButton
          v-if="header.hasNextLevel.value"
          class="building-heading__upgrade"
          size="sm"
          :disabled="!header.meetsRealmRequirement.value || !header.canAffordUpgrade.value"
          :title="!header.meetsRealmRequirement.value ? `Cần đạt ${header.requiredRealmName.value}` : header.upgradeCostLabel.value || 'Không có chi phí nâng cấp được cấu hình'"
          @click="header.upgrade"
        >
          Nâng công trình
        </GameButton>

        <small v-if="header.hasNextLevel.value" class="building-heading__cost">
          <template v-if="!header.meetsRealmRequirement.value">Cần đạt {{ header.requiredRealmName.value }}</template>
          <template v-else-if="header.upgradeCostLabel.value">{{ header.upgradeCostLabel.value }}</template>
        </small>
      </div>
    </template>

    <div v-if="mode" class="function-overlay">
      <ProductionPanel v-if="mode === 'exploration'" />
      <SettingsPanel v-else-if="mode === 'settings'" />
      <PillRoomPanel v-else-if="mode === 'pill_room'" />
      <EquipmentHallPanel v-else-if="mode === 'equipment_hall'" />
      <SpiritSpringPanel v-else-if="mode === 'spirit_spring'" />
      <ScripturePavilionPanel v-else-if="mode === 'scripture_pavilion'" />
      <StageSelectPanel v-else-if="mode === 'stage_select'" />
      <VendorPanel v-else-if="mode === 'vendor'" />
    </div>
  </OverlayPanel>
</template>

<style scoped>
.function-overlay { height: 100%; display: flex; flex-direction: column; }

.building-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.building-heading__art {
  flex: 0 0 auto;
  width: 44px;
  height: 38px;
  object-fit: cover;
  border: 1px solid var(--frame-outer);
  border-radius: 50% 50% var(--radius-sm) var(--radius-sm);
  background: var(--paper-200);
  filter: saturate(.9) contrast(1.08);
}

.building-heading__text { min-width: 0; }
.building-heading__name { margin: 0; color: var(--paper-text, #211f1a); font: 700 var(--text-title) var(--font-display); letter-spacing: .06em; }
.building-heading__level { color: var(--jade); font-size: var(--text-sm); }

.building-heading__upgrade-area { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }

.building-heading__upgrade:disabled {
  background: var(--paper-200);
  color: var(--paper-text-muted);
}

.building-heading__cost {
  text-align: right;
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
}

@container overlay-panel (max-width: 640px) {
  .building-heading__upgrade-area { align-items: flex-start; }
  .building-heading__cost { text-align: left; }
}
</style>
