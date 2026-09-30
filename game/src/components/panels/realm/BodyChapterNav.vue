<script setup lang="ts">
// Huyen Kim SS20 (Dao The / Kinh Mach) - left chapter rail of the body
// progression area: one chip per chapter carrying progress + lock
// state. Locked chapters stay viewable (the chapter column explains
// the gate) - they are marked, not disabled.
import { useI18n } from 'vue-i18n'
import type { BodyChapterId } from '@/core/realm/body/BodyChapter'

export interface BodyChapterEntry {
  id: BodyChapterId
  label: string
  unlocked: boolean
  completed: number
  total: number
}

defineProps<{
  chapters: BodyChapterEntry[]
  activeId: BodyChapterId
}>()

const emit = defineEmits<{ select: [id: BodyChapterId] }>()
const { t } = useI18n()
</script>

<template>
  <nav class="body-chapters" :aria-label="t('panels.realm.body.navAria')">
    <button
      v-for="chapter in chapters"
      :key="chapter.id"
      type="button"
      class="body-chapters__item"
      :class="{
        'is-active': chapter.id === activeId,
        'is-locked': !chapter.unlocked,
        'is-complete': chapter.unlocked && chapter.completed >= chapter.total,
      }"
      @click="emit('select', chapter.id)"
    >
      <span class="body-chapters__label">{{ chapter.label }}</span>
      <span class="body-chapters__progress">{{ chapter.completed }}/{{ chapter.total }}</span>
    </button>
  </nav>
</template>

<style scoped>
.body-chapters {
  display: flex;
  flex-direction: column;
  gap: var(--hk-space-2, 4px);
}

.body-chapters__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--hk-density-compact-pad-y, 6px) var(--hk-density-compact-pad-x, 10px);
  background: var(--hk-surface-raised, #131b17);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--hk-radius-md, 8px);
  color: var(--hk-text-secondary, #b8ae97);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--hk-motion-micro, 150ms) var(--hk-ease-standard, ease);
}

.body-chapters__item:hover {
  border-color: var(--hk-border-active, #7a6234);
}

/* Selected = jade body accent + gold structural edge (SS47). */
.body-chapters__item.is-active {
  border-color: var(--hk-border-ceremony, #e8c35a);
  background: color-mix(in srgb, var(--hk-jade, #3fa68b) 14%, var(--hk-surface-raised, #131b17));
  color: var(--hk-text-primary, #ede6d6);
}

.body-chapters__item.is-locked {
  opacity: 0.55;
  color: var(--hk-ink, #5b6266);
}

.body-chapters__item.is-complete .body-chapters__progress {
  color: var(--hk-jade, #3fa68b);
}

.body-chapters__label {
  font-weight: 600;
}

.body-chapters__progress {
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--hk-text-muted, #7a7260);
}
</style>
