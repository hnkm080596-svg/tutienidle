<script setup lang="ts">
// Scene 09 scaffold - chapter-tabs region (spec 444/176/680/44).
// Zone selection lives on the zone-rail; this row owns the chapter
// chips only and keeps the contract class `--chapters`.
import { useI18n } from 'vue-i18n'
import Chip from '@/components/common/primitives/Chip.vue'

defineProps<{
  chapterOptions: { chapter: number; label: string }[]
  selectedChapter: number
}>()

const emit = defineEmits<{
  (e: 'select-chapter', chapter: number): void
}>()

const { t } = useI18n()
</script>

<template>
  <nav class="stage-select__filters exploration-tabs" :aria-label="t('panels.stageSelect.aria.filters')">
    <div class="stage-select__filter-group stage-select__filter-group--chapters">
      <small>{{ t('panels.stageSelect.labels.chapterFilter') }}</small>
      <Chip
        v-for="chapter in chapterOptions"
        :key="chapter.chapter"
        class="stage-select__filter-chip art-needed"
        data-art-id="exploration-chapter-tab"
        :active="chapter.chapter === selectedChapter"
        @click="emit('select-chapter', chapter.chapter)"
      >
        {{ chapter.label }}
      </Chip>
    </div>
  </nav>
</template>

<style scoped>
/* Spec 09: the 680px tab band hangs inside the 700px map column ->
   97.14% of the column, centered. */
.exploration-tabs {
  flex: 0 0 auto;
  width: 97.14%;
  align-self: center;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--paper-line);
  background: color-mix(in srgb, var(--scene-portal-glow) 6%, var(--paper-100));
}

.exploration-tabs :deep(.stage-select__filter-group) {
  display: flex;
  align-items: center;
  gap: 5px;
}

.exploration-tabs :deep(.stage-select__filter-group small) {
  margin-right: 3px;
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: .08em;
}

.exploration-tabs :deep(.stage-select__filter-chip) {
  padding: 5px 10px;
  font-weight: 600;
  /* Filter Dia Gioi dung palette portal teal - de cong thuc chrome chuan
     cua Chip bang CSS var local. */
  --chip-active-bg: color-mix(in srgb, var(--scene-portal-glow) 20%, var(--paper-50));
}

.exploration-tabs :deep(.stage-select__filter-chip.is-active) {
  border-color: var(--scene-portal-accent);
  color: color-mix(in srgb, var(--scene-portal-accent) 55%, var(--brush-950) 45%);
}

.exploration-tabs :deep(.stage-select__filter-chip.is-locked) {
  opacity: 0.55;
}
</style>
