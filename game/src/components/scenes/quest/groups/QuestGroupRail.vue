<script setup lang="ts">
// Group rail (Codex landscape preview, left column): vertical
// medallion buttons over the thematic group axis - 'all' first, then
// one medallion per group id the rows actually carry. Labels/hints
// resolve through panels.quest.groups / .groupHints; an unknown id
// renders its raw id on the shared fallback icon so new group ids the
// domain adds later still show up instead of vanishing silently.
import { useI18n } from 'vue-i18n'
import QuestCategoryArtButton from '@/components/common/art/QuestCategoryArtButton.vue'
import { questGroupIcon } from './questGroupArt'

// Preview cadence tabs shown locked until the cadence ships (beta has
// 'once' only); order matches the Codex landscape rail.
const PREVIEW_LOCKED = ['daily', 'weekly', 'achievement', 'expedition'] as const

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

function hint(id: string): string {
  const key = `panels.quest.groupHints.${id}`
  return te(key) ? t(key) : ''
}
</script>

<template>
  <nav class="quest-group-rail" :aria-label="t('panels.quest.scene.tabsAria')">
    <QuestCategoryArtButton
      v-for="id in ['all', ...groups]"
      :key="id"
      :icon="questGroupIcon(id)"
      :label="label(id)"
      :hint="hint(id)"
      :selected="active === id"
      @click="onSelect(id)"
    />
    <QuestCategoryArtButton
      v-for="id in PREVIEW_LOCKED"
      :key="id"
      :icon="questGroupIcon(id)"
      :label="t(`panels.quest.previewTabs.${id}`)"
      :hint="t('panels.quest.lockedHint')"
      :selected="false"
      locked
    />
  </nav>
</template>

<style scoped>
.quest-group-rail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 10px 4px 4px;
}
.quest-group-rail::-webkit-scrollbar { display: none; }
</style>
