<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore, type BagTab } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import EquipmentBagSection from './bag-sections/EquipmentBagSection.vue'
import MaterialBagSection from './bag-sections/MaterialBagSection.vue'
import PillBagSection from './bag-sections/PillBagSection.vue'
import TabBar from '@/components/common/TabBar.vue'

// Hành Trang (2026-08-25, resource-professions-rework plan §10.1) —
// Phù/Trận khai tử: còn 3 tab (Trang Bị/Nguyên Liệu/Đan Dược), bỏ hẳn
// luồng pending-select phù/trận liên-panel.
const BAG_TABS: { tab: BagTab; label: string }[] = [
  { tab: 'equipment', label: 'Trang Bị' },
  { tab: 'material', label: 'Nguyên Liệu' },
  { tab: 'pill', label: 'Đan Dược' },
]

const ui = useUiStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const activeTab = computed<BagTab>(() => ui.activeBagTab)

const BAG_COUNTS: Record<BagTab, () => number> = {
  equipment: () => gameManager.equipmentBag.getAll().length,
  material: () => gameManager.materialBag.getAll().length,
  pill: () => gameManager.pillBag.getAll().length,
}

const activeTabCount = computed(() => {
  stateVersion.value

  return BAG_COUNTS[activeTab.value]()
})
</script>

<template>
  <div class="bag-grid">
    <div class="bag-grid__header">
      <span class="bag-grid__title">Kho Vật</span>
      <span class="bag-grid__count">{{ activeTabCount }} món</span>
    </div>

    <TabBar
      :tabs="BAG_TABS.map((entry) => ({ id: entry.tab, label: entry.label }))"
      :model-value="ui.activeBagTab"
      @update:model-value="ui.setActiveBagTab($event as BagTab)"
    />

    <div class="bag-grid__body">
      <EquipmentBagSection v-if="activeTab === 'equipment'" />

      <MaterialBagSection v-else-if="activeTab === 'material'" />

      <PillBagSection v-else-if="activeTab === 'pill'" />
    </div>
  </div>
</template>

<style scoped>
.bag-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 8px;
  gap: 8px;
  box-sizing: border-box;
  font-family: var(--font-body);
  color: var(--paper-text);
}

.bag-grid__header {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.bag-grid__title {
  font-family: var(--font-display);
  font-size: var(--text-title);
  font-weight: 700;
  color: var(--paper-text);
}

.bag-grid__count {
  font-size: var(--text-sm);
  color: var(--paper-text-muted);
}

.bag-grid__body {
  flex: 1;
  min-height: 0;
}
</style>
