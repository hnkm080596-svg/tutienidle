<script setup lang="ts">
// Compatibility shim - the Scene 03 quest tracker moved into
// components/scenes/dong-fu/hud/ (see
// docs/design/art-requests/03-dong-fu.md). The canonical
// getBetaQuestSurfaceModels contract is unchanged.
import DongFuQuestTracker from '@/components/scenes/dong-fu/hud/DongFuQuestTracker.vue'
</script>

<template>
  <DongFuQuestTracker />
</template>
