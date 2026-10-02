<script setup lang="ts">
import BagGrid from './BagGrid.vue'
</script>

<template>
  <div class="inventory-panel">
    <BagGrid />
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
