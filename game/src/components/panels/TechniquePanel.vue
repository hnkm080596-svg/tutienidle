<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import TechniqueSurface from '@/components/scenes/technique/TechniqueSurface.vue'

// Scene 06 (Tam Phap) fidelity integration: the imperial-scroll scene is
// replaced by the approved technique-v2 paper surface mounted on an
// overlay design canvas above the Dong Fu vista. The store contract is
// unchanged - ui.standalonePanel === 'technique' is the open authority
// and closeHomeOverlays() is the close command.
const ui = useUiStore()
</script>

<template>
  <Transition name="th-panel-swap"><TechniqueSurface v-if="ui.standalonePanel === 'technique'" /></Transition>
</template>
