<script setup lang="ts">
// Shared tab buttons preserve section identity and selection hooks.
import GameTabButton from '@/components/common/GameTabButton.vue'

defineProps<{
  sections: Array<{ id: string; label: string }>
  activeId: string
  label: string
}>()

const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <nav class="settings-panel__nav" :aria-label="label" data-hk-region="nav-rail">
    <GameTabButton
      v-for="section in sections"
      :key="section.id"
      class="settings-panel__nav-seal"
      :class="{ 'is-active': activeId === section.id }"
      :data-section="section.id"
      :selected="activeId === section.id"
      @click="emit('select', section.id)"
    >{{ section.label }}</GameTabButton>
  </nav>
</template>

<style scoped>
.settings-panel__nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}
.settings-panel__nav::-webkit-scrollbar { display: none; }

.settings-panel__nav-seal:focus-visible { outline: 2px solid var(--hk-gold, var(--gold-700)); outline-offset: 2px; }
.settings-panel__nav-seal.game-tab-button { width: 100%; min-height: 44px; font-size: 16px; }
</style>
