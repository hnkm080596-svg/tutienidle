<script setup lang="ts">
// Compatibility shim - the Scene 03 Dong Fu home scene was decomposed
// into the fine-grained scaffold under components/scenes/dong-fu/ (see
// docs/design/art-requests/03-dong-fu.md). DongFuHomeScene owns the
// variant/parallax/focus orchestration unchanged.
import DongFuHomeScene from '@/components/scenes/dong-fu/DongFuHomeScene.vue'
</script>

<template>
  <DongFuHomeScene />
</template>
