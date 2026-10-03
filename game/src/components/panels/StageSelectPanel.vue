<script setup lang="ts">
// Scene 10 (Tham Hiem - Son Ha Do) fidelity integration: the imperial-
// scroll stage-select composition is replaced by the approved
// exploration-v2 paper surface mounted on an overlay design canvas
// above the Dong Fu vista. The store contract is unchanged -
// ui.leftPanelMode === 'stage_select' is the open authority and
// closeHomeOverlays() is the close command; the teleport_array
// construction gate stays the domain admission check inside the
// surface.
import { useUiStore } from '@/stores/ui'
import ExplorationSurface from '@/components/scenes/exploration/ExplorationSurface.vue'

const ui = useUiStore()
</script>

<template>
  <ExplorationSurface v-if="ui.leftPanelMode === 'stage_select'" />
</template>
