<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore, type BagTab } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { betaMaterialStackVisible, scopeHiddenPillFamilyOfId } from '@/core/betaScope'
import { usePlayerStore } from '@/stores/player'
import EquipmentBagSection from './bag-sections/EquipmentBagSection.vue'
import MaterialBagSection from './bag-sections/MaterialBagSection.vue'
import PillBagSection from './bag-sections/PillBagSection.vue'
import TabBar from '@/components/common/TabBar.vue'

// Hanh Trang (2026-08-25, resource-professions-rework plan sec10.1) -
// Phu/Tran khai tu: con 3 tab (Trang Bi/Nguyen Lieu/Dan Duoc), bo han
// luong pending-select phu/tran lien-panel.
const { t } = useI18n()

const ui = useUiStore()
const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()

const activeTab = computed<BagTab>(() => ui.activeBagTab)

const BAG_COUNTS: Record<BagTab, () => number> = {
  equipment: () => gameManager.equipmentBag.getAll().length,
  // Same suppressed-source filter as the section's entries - the tab
  // count must agree with what the grid can render.
  material: () =>
    gameManager.materialBag
      .getAll()
      .filter((stack) => betaMaterialStackVisible(stack.material, player.realmId)).length,
  // Same scope-hidden family filter as the section's entries - the tab
  // count must agree with what the grid can render.
  pill: () =>
    gameManager.pillBag
      .getAll()
      .filter((stack) => scopeHiddenPillFamilyOfId(stack.pill.id) === null).length,
  // The decompose tab renders no grid entries here - it routes to the
  // equipment hall surface, so its count is always 0.
  decompose: () => 0,
}

const activeTabCount = computed(() => {
  stateVersion.value

  return BAG_COUNTS[activeTab.value]()
})

const bagTabs = computed(() => [
  { id: 'equipment' as BagTab, label: t('panels.bag.tabs.equipment') },
  { id: 'material' as BagTab, label: t('panels.bag.tabs.material') },
  { id: 'pill' as BagTab, label: t('panels.bag.tabs.pill') },
])
</script>

<template>
  <div class="bag-grid">
    <div class="bag-grid__header">
      <span class="bag-grid__count">{{ activeTabCount }} {{ t('panels.bag.countSuffix') }}</span>
    </div>

    <TabBar
      :tabs="bagTabs"
      :model-value="ui.activeBagTab"
      art-id="tab-pill"
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
  justify-content: flex-end;
}

.bag-grid__count {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: var(--text-sm);
  color: var(--paper-text-muted);
}

.bag-grid__body {
  flex: 1;
  min-height: 0;
}
</style>
