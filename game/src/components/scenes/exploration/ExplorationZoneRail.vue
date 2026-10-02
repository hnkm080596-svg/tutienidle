<script setup lang="ts">
// Scene 09 scaffold - zone-rail region (spec 288/176/140/560). Audit:
// RESERVED - the rail is an architecture slot for the full product's
// zone cards; nothing renders until a coordinator enables it.
defineProps<{
  visible?: boolean
}>()
</script>

<template>
  <aside
    v-if="visible"
    class="exploration-zone-rail"
    data-art-id="exploration-zone-rail"
    aria-hidden="true"
  />
</template>

<style scoped>
.exploration-zone-rail {
  width: 112px;
  border-right: 1px solid var(--paper-line);
}
</style>
