<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore, type BagTab } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import EquipmentBagSection from './bag-sections/EquipmentBagSection.vue'
import MaterialBagSection from './bag-sections/MaterialBagSection.vue'
import PillBagSection from './bag-sections/PillBagSection.vue'

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

    <div class="bag-grid__tabs bag-grid__tabs--three">
      <button
        v-for="entry in BAG_TABS"
        :key="entry.tab"
        type="button"
        :class="{ 'is-active': ui.activeBagTab === entry.tab }"
        @click="ui.setActiveBagTab(entry.tab)"
      >
        {{ entry.label }}
      </button>
    </div>

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
  color: var(--text-primary);
}

.bag-grid__header {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.bag-grid__title {
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary);
}

.bag-grid__count {
  font-size: 0.66rem;
  color: var(--text-muted);
}

.bag-grid__tabs {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-items: stretch;
  gap: 4px;
}

.bag-grid__tabs button {
  justify-self: stretch;
  padding: 4px 2px;
  font-size: var(--text-xs);
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
}

.bag-grid__tabs button.is-active {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.bag-grid__body {
  flex: 1;
  min-height: 0;
}
</style>
