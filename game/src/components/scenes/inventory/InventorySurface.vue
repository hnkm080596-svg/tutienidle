<script setup lang="ts">
// Scene 09 (Tui Do) production adapter -- fidelity scroll-content
// composition with the canonical bag contract:
//   toolbar -> the 3 canonical tabs driving ui.activeBagTab
//   grid    -> the real section for the active tab (sections own their
//              own search/group chips/sort/pagination verbatim)
//   count   -> BagGrid's canonical count logic (same suppressed-source
//              and scope-hidden filters the sections apply)
// The fidelity detail rail + toolbar search/sort are preview-only - the
// canonical surface inspects items via section tooltips and actions.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore, type BagTab } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { betaMaterialStackVisible, scopeHiddenPillFamilyOfId } from '@/core/betaScope'
import InventoryFidelityScene from './fidelity/InventoryFidelityScene.vue'
import EquipmentBagSection from '@/components/panels/bag-sections/EquipmentBagSection.vue'
import MaterialBagSection from '@/components/panels/bag-sections/MaterialBagSection.vue'
import PillBagSection from '@/components/panels/bag-sections/PillBagSection.vue'

const { t } = useI18n()
const ui = useUiStore()
const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()

const activeTab = computed<BagTab>(() => ui.activeBagTab)

// Canonical counting, verbatim from BagGrid (the tab count must agree
// with what the section's filtered entries can render).
const BAG_COUNTS: Record<BagTab, () => number> = {
  equipment: () => gameManager.equipmentBag.getAll().length,
  material: () =>
    gameManager.materialBag
      .getAll()
      .filter((stack) => betaMaterialStackVisible(stack.material, player.realmId)).length,
  pill: () =>
    gameManager.pillBag
      .getAll()
      .filter((stack) => scopeHiddenPillFamilyOfId(stack.pill.id) === null).length,
}

const activeTabCount = computed(() => {
  stateVersion.value
  return BAG_COUNTS[activeTab.value]()
})

const bagTabs: readonly { id: BagTab; labelKey: string }[] = [
  { id: 'equipment', labelKey: 'panels.bag.tabs.equipment' },
  { id: 'material', labelKey: 'panels.bag.tabs.material' },
  { id: 'pill', labelKey: 'panels.bag.tabs.pill' },
]

function selectTab(id: BagTab) {
  ui.setActiveBagTab(id)
}
</script>

<template>
  <InventoryFidelityScene :items="[]" :selected="undefined" filter="equipment" query="">
    <template #toolbar>
      <div class="toolbar"><nav><button v-for="tab in bagTabs" :key="tab.id" :aria-pressed="activeTab === tab.id" @click="selectTab(tab.id)">{{ t(tab.labelKey) }}</button></nav></div>
    </template>
    <template #grid>
      <EquipmentBagSection v-if="activeTab === 'equipment'" />
      <MaterialBagSection v-else-if="activeTab === 'material'" />
      <PillBagSection v-else-if="activeTab === 'pill'" />
    </template>
    <template #count>{{ activeTabCount }} {{ t('panels.bag.countSuffix') }}</template>
  </InventoryFidelityScene>
</template>

<style scoped>
/* Slot content carries this scope id - toolbar chrome is duplicated from
   the scene's fixture bar so the real tab nav renders identically. */
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  height: 42px;
  margin-bottom: 20px;
}
.toolbar nav {
  display: flex;
  gap: 7px;
  margin-right: auto;
}
.toolbar button {
  background: transparent;
  border: 0;
  border-bottom: 3px solid transparent;
  color: #654d30;
  height: 40px;
  padding: 0 16px;
  font: 700 17px var(--font-display, Georgia, serif);
  cursor: pointer;
}
.toolbar button[aria-pressed='true'] {
  color: #285237;
  border-color: #967139;
}
.toolbar button:focus-visible {
  outline: 2px solid #806126;
  outline-offset: 3px;
}

/* The canonical sections fill the fidelity bag column. */
:deep(.bag) {
  display: flex;
  flex-direction: column;
}
</style>
