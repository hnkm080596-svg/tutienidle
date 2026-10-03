<script setup lang="ts">
// Compatibility shim - the Scene 03 top bar was decomposed into
// components/scenes/dong-fu/hud/ (see
// docs/design/art-requests/03-dong-fu.md). Region behavior (identity /
// resources / utility seals + feedback dialog) is unchanged.
import DongFuTopBar from '@/components/scenes/dong-fu/hud/DongFuTopBar.vue'
</script>

<template>
  <DongFuTopBar />
</template>
