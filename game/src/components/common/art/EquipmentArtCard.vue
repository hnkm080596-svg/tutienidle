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
}
.equipment-art-card::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  border: 15px solid transparent;
  border-image: var(--equipment-card-art) 90 fill / 15px stretch;
}
</style>
