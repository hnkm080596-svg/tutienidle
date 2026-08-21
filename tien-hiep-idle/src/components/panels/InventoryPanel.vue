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
}
</style>
