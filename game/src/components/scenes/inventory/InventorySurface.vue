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
import { isBetaEquipmentTab } from '@/core/betaScope'
import { useMasterAccess } from '@/services/master/masterAccess'
import InventoryFidelityScene from './fidelity/InventoryFidelityScene.vue'
import MaterialBagSection from '@/components/panels/bag-sections/MaterialBagSection.vue'
import PillBagSection from '@/components/panels/bag-sections/PillBagSection.vue'
import DecomposeTab from '@/components/panels/equipment-hall/DecomposeTab.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

// Dark workspace card - same nine-slice chrome the equipment bag wears
// (owner ruling 2026-10-11: Tru Vat matches the Trang Bi bag-card
// layout, full width since no doll column).
const cardArt = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png')
// Owner ruling 2026-10-11: Tru Vat tabs wear the same drawn button art
// as the equipment workspace tabs (secondary pill on every tab, primary
// gold on the active one - no divider brush, owner ruling 2026-10-11).
const secondaryButtonArt = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/button-secondary-v1.png')
const primaryButtonArt = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/button-primary-v1.png')
// Owner ruling 2026-10-11: no divider-brush under the active tab - selected
// state is just the gold primary pill (see scoped .toolbar rules below).

const { t } = useI18n()
const ui = useUiStore()

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
        <nav :style="{ '--inventory-btn-secondary': `url('${secondaryButtonArt}')`, '--inventory-btn-primary': `url('${primaryButtonArt}')` }">
          <button v-for="tab in bagTabs" :key="tab.id" :aria-pressed="activeTab === tab.id" @click="selectTab(tab.id)">
            {{ t(tab.labelKey) }}
          </button>
        </nav>
      </div>
    </template>
    <template #grid>
      <!-- The bag-panel container anchor lives here (inside the grid
           region), NOT on a wrapper around the canvas: container-type
           implies contain:layout, which would make the scaled design
           canvas resolve against it instead of the viewport. -->
      <div class="bag-anchor" :style="{ '--inventory-card-art': `url('${cardArt}')` }">
        <MaterialBagSection v-if="activeTab === 'material'" />
        <PillBagSection v-else-if="activeTab === 'pill'" />
        <DecomposeTab v-else />
      </div>
    </template>
  </InventoryFidelityScene>
  </SceneDesignCanvas>
</template>

<style scoped>
/* Slot content carries this scope id - toolbar chrome is duplicated from
   the scene's fixture bar so the real tab nav renders identically. */
/* Owner ruling 2026-10-11: tab row anchors at the card's RIGHT edge like
   Trang Bi's tabs (last pill ends at the card's right edge), and the pill
   bottom lands on the card edge (y216 against card top 215) - flush, not
   overlapping the border line. Global pin overrides height/margin. */
.toolbar {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: flex-end;
  height: 38px;
  margin-bottom: 4px;
  padding-top: 6px;
}
.toolbar nav {
  display: flex;
  gap: 12px;
}
/* Same drawn-button chrome as the equipment workspace tabs (owner
   ruling 2026-10-11): secondary pill on every tab via nine-slice
   ::before, primary gold on the active tab, brush under its label.
   Owner ruling: content-sized buttons packed left like Trang Bi's
   tabs - no stretch. */
.toolbar nav button {
  position: relative;
  isolation: isolate;
  flex: 0 0 auto;
  min-height: 33px;
  padding: 3px 12px 5px;
  border: 0;
  background: transparent;
  color: #f4e4c0;
  font: 700 19px var(--font-display, Georgia, serif);
  cursor: pointer;
  white-space: nowrap;
}
.toolbar nav button::before {
  content: '';
  position: absolute;
  inset: 0 -2px;
  z-index: -1;
  border: 9px solid transparent;
  border-image: var(--inventory-btn-secondary) var(--pc-button-slice) stretch;
  pointer-events: none;
}
/* Owner ruling 2026-10-11: no divider-brush under the active tab - the
   selected state is just the gold primary pill, nothing extra. */
.toolbar nav button[aria-pressed='true'] {
  color: #2f2415;
  text-shadow: 0 1px #fff7;
}
.toolbar nav button[aria-pressed='true']::before {
  border-image-source: var(--inventory-btn-primary);
}
.toolbar nav button:not(:disabled):hover {
  color: #fff3d6;
}
.toolbar nav button:not(:disabled):hover::before {
  filter: brightness(1.1);
}
.toolbar nav button:focus-visible {
  outline: 2px solid #806126;
  outline-offset: 3px;
}
/* The canonical sections fill the fidelity bag column; the anchor also
   carries the container name BagPaginationControls queries
   (@container bag-panel). Dark card chrome = the equipment workspace
   card verbatim (character-card nine-slice + dark overlay). */
.bag-anchor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  container-type: inline-size;
  container-name: bag-panel;
  padding: 14px 16px;
  border: 15px solid transparent;
  border-image: var(--inventory-card-art) 160 / 15px stretch;
  clip-path: inset(5.1px 2.1px 5.7px 2.2px round 6px);
  background: linear-gradient(#000000d9, #000000d9) border-box 2px 5px / calc(100% - 4px) calc(100% - 11px) no-repeat;
  color: #f3e4c4;
}
</style>
