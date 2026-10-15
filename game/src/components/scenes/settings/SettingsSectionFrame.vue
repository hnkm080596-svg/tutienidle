<script setup lang="ts">
import GameCard from '@/components/common/GameCard.vue'
defineProps<{ title: string; label: string }>()
</script>
<template>
  <GameCard class="settings-panel__section" :title="title" :aria-label="label"><slot /></GameCard>
</template>
<style scoped>
.settings-panel__section { flex: 0 0 auto; min-width: 0; padding: 48px 16px 18px; --paper-text: #f3e4c4; --paper-text-soft: #d3bd92; --paper-line: #b28a4355; color: var(--paper-text); }
.settings-panel__section :deep(.game-action-button) { min-width: 170px; height: 44px; font-size: 16px; }
</style>
