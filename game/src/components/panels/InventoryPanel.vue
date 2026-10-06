<script setup lang="ts">
// Scene 09 (Kho Vat) mount seam: the imperial-scroll shell is retired -
// the production surface owns the shared paper chrome on an overlay
// design canvas. The bag-panel container anchor moved inside the
// surface's #grid region (the anchor's contain:layout must not wrap the
// scaled canvas - see InventorySurface).
import InventorySurface from '@/components/scenes/inventory/InventorySurface.vue'
</script>

<template>
  <div class="inventory-panel">
    <InventorySurface />
  </div>
</template>

<style scoped>
.inventory-panel {
  position: fixed;
  inset: 0;
  /* transparent wrapper - the scene's own regions opt back in, and rail
     clicks in the left column fall through to the real rail. */
  pointer-events: none;
}
</style>
