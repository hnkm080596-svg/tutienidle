<script setup lang="ts">
// Group rail (left column): vertical GameTabButton pills over the
// thematic group axis - 'all' first, then one tab button per group id
// the rows actually carry, matching the Ren The / Khai Mach chapter tabs.
import { useI18n } from 'vue-i18n'
import GameTabButton from '@/components/common/GameTabButton.vue'

defineProps<{
  groups: readonly string[]
  active: string
  onSelect: (id: string) => void
}>()

const { t, te } = useI18n()

function label(id: string): string {
  const key = `panels.quest.groups.${id}`
  return id === 'all' ? t('panels.quest.tabs.all') : te(key) ? t(key) : id
}
</script>

<template>
  <nav class="quest-group-rail" :aria-label="t('panels.quest.scene.tabsAria')">
    <GameTabButton
      v-for="id in ['all', ...groups]"
      :key="id"
      class="quest-group-rail__tab"
      :selected="active === id"
      @click="onSelect(id)"
    >
      <span class="quest-group-rail__label">{{ label(id) }}</span>
    </GameTabButton>
  </nav>
</template>

<style scoped>
.quest-group-rail {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 6px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 6px 4px 4px;
}
.quest-group-rail::-webkit-scrollbar { display: none; }
.quest-group-rail__tab {
  width: 100%;
}
</style>
