<script setup lang="ts">
// Mount wrapper - the technique scene lives decomposed under
// components/scenes/technique/ (scene-06 scaffold). Mount contract kept:
// renders only while ui.standalonePanel === 'technique'.
import TechniqueScrollScene from '@/components/scenes/technique/TechniqueScrollScene.vue'
</script>

<template>
  <TechniqueScrollScene />
</template>
