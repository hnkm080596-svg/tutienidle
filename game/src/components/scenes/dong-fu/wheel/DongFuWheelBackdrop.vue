<script setup lang="ts">
// Dao Luan scrim (scene 03 wheel region): the dimmed field behind the
// open command wheel. Clicking empty space dismisses the wheel AND blocks
// click-through to the building hotspots beneath (Workstream C).
// Temporary CSS art pending the backdrop treatment (art inventory
// 03-dong-fu).
const emit = defineEmits<{
  dismiss: []
}>()
</script>

<template>
  <div
    class="command-wheel-layer__backdrop"
    art-needed
    data-art-id="dao-luan-backdrop"
    aria-hidden="true"
    @click="emit('dismiss')"
  />
</template>

<style scoped>
.command-wheel-layer__backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--hk-surface-base, var(--ink-950)) 52%, transparent);
  cursor: pointer;
}
</style>
