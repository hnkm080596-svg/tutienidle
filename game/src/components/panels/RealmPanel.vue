<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import RealmSurface from '@/components/scenes/realm/RealmSurface.vue'

// Scene 05 (Thien Lo) fidelity integration: the imperial-scroll shell +
// scene-region composition is replaced by the approved realm-v2 paper
// surface mounted on an overlay design canvas above the Dong Fu vista.
// The store contract is unchanged - ui.standalonePanel === 'realm' is
// the open authority and closeHomeOverlays() is the close command.
const ui = useUiStore()
</script>

<template>
  <RealmSurface v-if="ui.standalonePanel === 'realm'" />
</template>
