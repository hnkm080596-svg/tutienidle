<script setup lang="ts">
import { equipmentArt } from './equipmentArt'
const style = { '--equipment-card-art': `url('${equipmentArt('character-card-nine-slice-v2')}')` }
</script>
<template>
  <section class="equipment-art-card" :style="style"><slot /></section>
</template>
<style scoped>
.equipment-art-card {
  position: relative;
  isolation: isolate;
  min-width: 0;
  min-height: 0;
  padding: 14px 16px;
  color: #f3e4c4;
  clip-path: inset(5.1px 2.1px 5.7px 2.2px round 6px);
}
.equipment-art-card::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  border: 15px solid transparent;
  border-image: var(--equipment-card-art) 160 / 15px stretch;
  background:linear-gradient(#000000d9,#000000d9) border-box 2px 5px/calc(100% - 4px) calc(100% - 11px) no-repeat;
  /* Owner ruling 2026-10-09: no `fill` - the source card art paints a
     landscape scene across its center which strips when stretched;
     center is a flat ink patch instead. */
  
}
</style>
