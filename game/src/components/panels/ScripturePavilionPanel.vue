<script setup lang="ts">
import '@/assets/pc-paper-auxiliary-production.css'
// Tang Kinh Cac - P7-M7 lore-only: the technique catalog tab retired
// with TechniqueCodex (the canonical technique lives on the
// SkillPathPanel band). Only the lore collection remains.
import LoreCodex from './scripture/LoreCodex.vue'
</script>

<template>
  <div class="scripture-pavilion pc-auxiliary">
    <div class="scripture-pavilion__body">
      <LoreCodex />
    </div>
  </div>
</template>

<style scoped>
.scripture-pavilion {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-family: var(--font-body);
}

.scripture-pavilion__body {
  flex: 1;
  min-height: 0;
}
</style>
