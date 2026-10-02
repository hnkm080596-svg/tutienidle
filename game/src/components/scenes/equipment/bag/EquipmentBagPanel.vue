<script setup lang="ts">
// Bag grid region (spec region bag-grid, 354 x 610, RIGHT side per the
// owner ruling on ref 12-equipment.jpg): the canonical BagGrid surface -
// category tabs corrected to the real sections (Equipment / Material /
// Pill), sort + filter + pagination owned inside each bag-section.
//
// The ref's "Dung Luong 86/200" capacity readout has no capacity model in
// the codebase (bags are unbounded), so the panel shows the canonical
// per-tab count the BagGrid header already renders - flagged for audit.
import { computed } from 'vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import BagGrid from '@/components/panels/BagGrid.vue'
import { chromeSlice } from '@/ui/huyenKimChrome'

const panelSlice = computed(() => chromeSlice('surface-m-panel'))
</script>

<template>
  <section class="equipment-bag-panel" data-hk-region="bag-grid">
    <InkNineSlice
      chrome-id="surface-m-panel"
      layer="surface"
      class="equipment-bag-panel__surface"
      :art-needed="!panelSlice || undefined"
      data-art-id="surface-m-panel"
    />

    <BagGrid class="equipment-bag-panel__grid" />
  </section>
</template>

<style scoped>
.equipment-bag-panel {
  position: relative;
  isolation: isolate;
  height: 100%;
  min-height: 0;
}

.equipment-bag-panel > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}

.equipment-bag-panel__grid {
  height: 100%;
  min-height: 0;
}
</style>
