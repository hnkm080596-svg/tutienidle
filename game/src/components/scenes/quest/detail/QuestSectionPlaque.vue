<script setup lang="ts">
// Section header shared by the detail panel's objectives / progress /
// rewards blocks: the approved preview's h3 (small gold caps on a
// faded rule) replaces the interim hanging-plaque chrome.
defineProps<{ text: string }>()
</script>

<template>
  <h3 class="quest-section-plaque">{{ text }}</h3>
</template>

<style scoped>
.quest-section-plaque {
  margin: 0;
  padding: 0 0 2px;
  font: 700 13px var(--font-display, Georgia, serif);
  letter-spacing: 0.06em;
  color: #f5ce78;
  border-bottom: 1px solid #94744455;
}
</style>
