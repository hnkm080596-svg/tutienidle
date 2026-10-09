<script setup lang="ts">
// Scene 09 (Kho Vat) production adapter -- the fidelity composition
// with the canonical bag contract, now mounted on the shared paper
// chrome inside an overlay design canvas (same chrome as the other
// migrated tabs):
//   toolbar -> the 2 non-equipment tabs driving ui.activeBagTab
//   grid    -> the real section for the active tab (sections own their
//              own search/group chips/sort/pagination verbatim)
//   count   -> BagGrid's canonical count logic (same suppressed-source
//              and scope-hidden filters the sections apply)
//
// Owner ruling 2026-10-04: equipment is hosted by the Khi Duong panel's
// Trang Bi tab; Kho Vat keeps ONLY non-gear goods (nguyen lieu, dan
// duoc). ui.activeBagTab may still arrive as 'equipment' from legacy
// state - it normalizes to 'material' so the grid never blanks.
// The fidelity detail rail + toolbar search/sort are preview-only - the
// canonical surface inspects items via section tooltips and actions.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { betaMaterialStackVisible, isBetaEquipmentTab, scopeHiddenPillFamilyOfId } from '@/core/betaScope'
import { useMasterAccess } from '@/services/master/masterAccess'
import InventoryFidelityScene from './fidelity/InventoryFidelityScene.vue'
import MaterialBagSection from '@/components/panels/bag-sections/MaterialBagSection.vue'
import PillBagSection from '@/components/panels/bag-sections/PillBagSection.vue'
import DecomposeTab from '@/components/panels/equipment-hall/DecomposeTab.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

const { t } = useI18n()
const ui = useUiStore()
const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()

/** Kho Vat's own tab set: goods only, no equipment (moved to Trang Bi).
 *  Owner ruling 2026-10-08: 'decompose' (Phan Giai, ore -> Luyen Khi
 *  Tinh Hoa) joins as a third tab - it is a materials op, so it belongs
 *  here and not on the equipment rail. It stays scope-hidden for beta
 *  (equipmentOreDecompose) but opens for the master account, same
 *  channel as wash/refine in Khi Duong. */
type InventoryTab = 'material' | 'pill' | 'decompose'

const { isMaster } = useMasterAccess()

const decomposeAdmitted = computed(() => isBetaEquipmentTab('decompose') || isMaster.value)

const activeTab = computed<InventoryTab>(() => {
  if (ui.activeBagTab === 'pill') return 'pill'
  if (ui.activeBagTab === 'decompose' && decomposeAdmitted.value) return 'decompose'
  return 'material'
})

// Canonical counting, verbatim from BagGrid (the tab count must agree
// with what the section's filtered entries can render).
const BAG_COUNTS: Record<'material' | 'pill', () => number> = {
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
  // Phan Giai operates on the live DecomposeSystem, not a bag list -
  // no item count to prefix its tab with.
  if (activeTab.value === 'decompose') return ''
  return `${BAG_COUNTS[activeTab.value]()} ${t('panels.bag.countSuffix')}`
})

const bagTabs = computed<readonly { id: InventoryTab; labelKey: string }[]>(() => [
  { id: 'material', labelKey: 'panels.bag.tabs.material' },
  { id: 'pill', labelKey: 'panels.bag.tabs.pill' },
  // The scope-hidden tab renders no shell at all here (unlike the
  // Khi Duong rail's disabled seals) - Kho Vat simply omits it.
  ...(decomposeAdmitted.value
    ? [{ id: 'decompose' as const, labelKey: 'panels.bag.tabs.decompose' }]
    : []),
])

function selectTab(id: InventoryTab) {
  ui.setActiveBagTab(id)
}
</script>

<template>
  <SceneDesignCanvas overlay>
  <InventoryFidelityScene :items="[]" :selected="undefined" filter="material" query="" notice="" @back="ui.closeHomeOverlays()">
    <template #toolbar>
      <div class="toolbar">
        <nav>
          <button v-for="tab in bagTabs" :key="tab.id" :aria-pressed="activeTab === tab.id" @click="selectTab(tab.id)">
            <!-- Active tab: drawn tab-seal chrome (manifest), not CSS. -->
            <InkNineSlice v-if="activeTab === tab.id" class="tab-seal" chrome-id="tab-seal" layer="surface" />
            <span class="tab-label">{{ t(tab.labelKey) }}</span>
          </button>
        </nav>
      </div>
      <!-- Under-tab divider: drawn divider-ornament line + endcap
           diamonds (ref image 2 chrome). -->
      <div class="toolbar-divider" aria-hidden="true">
        <InkNineSlice chrome-id="divider-ornament" layer="surface" />
      </div>
    </template>
    <template #grid>
      <!-- The bag-panel container anchor lives here (inside the grid
           region), NOT on a wrapper around the canvas: container-type
           implies contain:layout, which would make the scaled design
           canvas resolve against it instead of the viewport. -->
      <div class="bag-anchor">
        <MaterialBagSection v-if="activeTab === 'material'" />
        <PillBagSection v-else-if="activeTab === 'pill'" />
        <DecomposeTab v-else />
      </div>
    </template>
    <template #count>{{ activeTabCount }}</template>
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
  height: 38px;
  margin-bottom: 4px;
}
.toolbar nav {
  display: flex;
  gap: 7px;
  margin-right: auto;
}
.toolbar button {
  position: relative;
  background: transparent;
  border: 0;
  color: #654d30;
  height: 36px;
  padding: 0 16px;
  font: 700 17px var(--font-display, Georgia, serif);
  cursor: pointer;
}
.toolbar button .tab-seal {
  inset: 2px 0;
}
.toolbar button .tab-label {
  position: relative;
  z-index: 2;
}
.toolbar button[aria-pressed='true'] {
  color: #f0e3c0;
}
.toolbar button:focus-visible {
  outline: 2px solid #806126;
  outline-offset: 3px;
}
.toolbar-divider {
  position: relative;
  height: 8px;
  margin-bottom: 4px;
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
