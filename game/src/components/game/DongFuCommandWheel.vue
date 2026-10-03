<script setup lang="ts">
// Compatibility shim - the Dao Luan command wheel was decomposed into
// components/scenes/dong-fu/wheel/ (see
// docs/design/art-requests/03-dong-fu.md). The layer component owns the
// open/close state machine and all slot/domain logic unchanged.
import DongFuCommandWheelLayer from '@/components/scenes/dong-fu/wheel/DongFuCommandWheelLayer.vue'
</script>

<template>
  <DongFuCommandWheelLayer />
</template>
