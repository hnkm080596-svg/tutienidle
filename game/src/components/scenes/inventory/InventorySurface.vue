<script setup lang="ts">
// Scene 09 (Kho Vat) production adapter -- the fidelity composition
// with the canonical bag contract, now mounted on the shared paper
// chrome inside an overlay design canvas (same chrome as the other
// migrated tabs):
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
import { usePaperNavigation } from '@/composables/usePaperNavigation'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { betaMaterialStackVisible, scopeHiddenPillFamilyOfId } from '@/core/betaScope'
import InventoryFidelityScene from './fidelity/InventoryFidelityScene.vue'
import EquipmentBagSection from '@/components/panels/bag-sections/EquipmentBagSection.vue'
import MaterialBagSection from '@/components/panels/bag-sections/MaterialBagSection.vue'
import PillBagSection from '@/components/panels/bag-sections/PillBagSection.vue'

const { t } = useI18n()
const ui = useUiStore()
const { items: navItems, navigate } = usePaperNavigation()
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
  <SceneDesignCanvas overlay>
  <InventoryFidelityScene :items="[]" :selected="undefined" filter="equipment" query="" :navigation="navItems" notice="" @navigate="navigate" @back="ui.closeHomeOverlays()">
    <template #toolbar>
      <div class="toolbar"><nav><button v-for="tab in bagTabs" :key="tab.id" :aria-pressed="activeTab === tab.id" @click="selectTab(tab.id)">{{ t(tab.labelKey) }}</button></nav></div>
    </template>
    <template #grid>
      <!-- The bag-panel container anchor lives here (inside the grid
           region), NOT on a wrapper around the canvas: container-type
           implies contain:layout, which would make the scaled design
           canvas resolve against it instead of the viewport. -->
      <div class="bag-anchor">
        <EquipmentBagSection v-if="activeTab === 'equipment'" />
        <MaterialBagSection v-else-if="activeTab === 'material'" />
        <PillBagSection v-else-if="activeTab === 'pill'" />
      </div>
    </template>
    <template #count>{{ activeTabCount }} {{ t('panels.bag.countSuffix') }}</template>
  </InventoryFidelityScene>
  </SceneDesignCanvas>
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

/* The canonical sections fill the fidelity bag column; the anchor also
   carries the container name BagPaginationControls queries
   (@container bag-panel). */
.bag-anchor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  container-type: inline-size;
  container-name: bag-panel;
}
</style>
