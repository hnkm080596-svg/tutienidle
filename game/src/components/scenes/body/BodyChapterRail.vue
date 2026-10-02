<script setup lang="ts">
// Scene 08 region `chapter-rail` (design 288/176/132/610): scene title,
// ? help affordance, and the three body-chapter seals.
import { useI18n } from 'vue-i18n'
import type { BodyChapterId } from '@/core/realm/body/BodyChapter'
import type { BodyChapterModel } from './useBodySceneModel'
import BodyChapterSeal from './BodyChapterSeal.vue'

defineProps<{
  chapters: BodyChapterModel[]
  activeId: BodyChapterId
}>()

const emit = defineEmits<{ select: [id: BodyChapterId] }>()
const { t } = useI18n()
</script>

<template>
  <nav class="body-rail" data-hk-region="chapter-rail" :aria-label="t('panels.realm.body.navAria')">
    <header class="body-rail__head">
      <span class="body-rail__title">{{ t('panels.realm.body.title') }}</span>
      <button
        type="button"
        class="body-rail__help"
        :title="t('panels.body.help')"
        :aria-label="t('panels.body.help')"
      >?</button>
    </header>

    <div class="body-rail__list">
      <BodyChapterSeal
        v-for="chapter in chapters"
        :key="chapter.id"
        :chapter="chapter"
        :active="chapter.id === activeId"
        @select="id => emit('select', id)"
      />
    </div>
  </nav>
</template>

<style scoped>
.body-rail {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.body-rail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 28px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--hk-border-muted, #2a352f);
}
.body-rail__title {
  font-family: var(--font-display, serif);
  font-weight: 700;
  /* The long scene title must stay inside the 132px rail: shrink +
     tight wrap instead of overflowing the plaque. */
  font-size: clamp(11px, 1cqw, var(--text-md));
  line-height: 1.15;
  overflow-wrap: break-word;
  color: var(--hk-gold-radiant, #f4d98b);
}
.body-rail__help {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--hk-border-muted, #2a352f);
  background: transparent;
  color: var(--hk-text-muted, #7a7260);
  font-size: var(--text-xs);
  cursor: pointer;
}
.body-rail__help:hover {
  border-color: var(--hk-border-ceremony, #b99a55);
  color: var(--hk-gold-radiant, #f4d98b);
}
.body-rail__list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
}
.body-rail__list::-webkit-scrollbar { display: none; }
</style>
