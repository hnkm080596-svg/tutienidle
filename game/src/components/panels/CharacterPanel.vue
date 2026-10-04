<script setup lang="ts">
import CharacterScene from '../scenes/character/CharacterScene.vue'

// Scene 04 mount point (imperial-scroll interior). The scene body was
// decomposed into game/src/components/scenes/character/* - this wrapper
// keeps the .character-panel hook and the LeftPanel mount contract.
</script>

<template>
  <section class="character-panel">
    <CharacterScene />
  </section>
</template>

<style scoped>
.character-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
