<script setup lang="ts">
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
const emit = defineEmits<{ layout: [] }>()
</script>
<template>
  <section class="combat-panel">
    <SceneDesignCanvas overlay @layout="emit('layout')"><div class="combat-panel__content"><slot /></div></SceneDesignCanvas>
    <SceneDesignCanvas overlay><div class="combat-panel__overlays"><slot name="overlays" /></div></SceneDesignCanvas>
  </section>
</template>
<style scoped>
.combat-panel { position: absolute; inset: 0; z-index: 15; isolation: isolate; pointer-events: none; }
.combat-panel__content { position: absolute; inset: 0; min-width: 0; min-height: 0; pointer-events: none; }
.combat-panel__overlays { position: absolute; inset: 0; pointer-events: none; }
</style>
