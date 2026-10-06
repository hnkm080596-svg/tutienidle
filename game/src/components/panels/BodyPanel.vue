<script setup lang="ts">
// Scene 08 (Luyen The) fidelity integration: the imperial-scroll body
// scene is replaced by the approved body-v2 paper surface (3-page flip)
// mounted on an overlay design canvas above the Dong Fu vista. The store
// contract is unchanged - ui.standalonePanel === 'body' is the open
// authority and closeHomeOverlays() is the close command.
import { useUiStore } from '@/stores/ui'
import BodySurface from '@/components/scenes/body/BodySurface.vue'

const ui = useUiStore()
</script>

<template>
  <Transition name="th-panel-swap"><BodySurface v-if="ui.standalonePanel === 'body'" /></Transition>
</template>
