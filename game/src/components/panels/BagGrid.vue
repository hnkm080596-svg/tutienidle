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

// Hành Trang (2026-08-25, resource-professions-rework plan §10.1) —
// Phù/Trận khai tử: còn 3 tab (Trang Bị/Nguyên Liệu/Đan Dược), bỏ hẳn
// luồng pending-select phù/trận liên-panel.
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

    <!-- Spec 09 capacity-bar footer (288/760/1244/48): the count rides
         the bottom edge, not a stray header pinned under the close
         button. -->
    <div class="bag-grid__footer">
      <span class="bag-grid__count">{{ activeTabCount }} {{ t('panels.bag.countSuffix') }}</span>
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

.bag-grid__footer {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  padding: 4px 2px 0;
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
