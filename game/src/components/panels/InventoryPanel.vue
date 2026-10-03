<script setup lang="ts">
// Scene 09 (Tui Do) mount seam: the panel keeps the bag-panel container
// anchor (BagPaginationControls' @container query) and mounts the
// fidelity production surface - canonical tabs + real sections.
import InventorySurface from '@/components/scenes/inventory/InventorySurface.vue'
</script>

<template>
  <div class="inventory-panel">
    <InventorySurface />
  </div>
</template>

<style scoped>
.inventory-panel {
  height: 100%;
  min-height: 0;
  /* Container anchor for the bag's narrow-width pagination rule
     (BagPaginationControls queries @container bag-panel). */
  container-type: inline-size;
  container-name: bag-panel;
}
</style>
