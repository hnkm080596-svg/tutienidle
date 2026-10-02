<script setup lang="ts">
// Scene 08 chapter-rail item: one vertical nav-seal per body chapter
// (Luyen The -> Bat Mach -> Chu Thien). Locked chapters stay viewable -
// the seal renders the ink/lock state, never hides (audit: EXACT).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { hkChromeUrl } from '@/ui/huyenKimChrome'
import type { BodyChapterId } from '@/core/realm/body/BodyChapter'
import type { BodyChapterModel } from './useBodySceneModel'
import { BODY_CHAPTER_LABEL_KEYS, bodyChapterSubtitleKey } from './useBodySceneModel'

const props = defineProps<{
  chapter: BodyChapterModel
  active: boolean
}>()

const emit = defineEmits<{ select: [id: BodyChapterId] }>()
const { t } = useI18n()

const sealUrl = hkChromeUrl('nav-seal-vertical')

const label = computed(() => t(BODY_CHAPTER_LABEL_KEYS[props.chapter.id]))
const subtitle = computed(() => t(bodyChapterSubtitleKey(props.chapter.id)))
const stateLabel = computed(() => {
  if (!props.chapter.unlocked) return t('panels.body.states.locked')
  if (props.chapter.completed >= props.chapter.total) return t('panels.body.states.done')
  return `${props.chapter.completed}/${props.chapter.total}`
})
</script>

<template>
  <button
    type="button"
    class="body-chapter-seal art-needed"
    :class="{
      'is-active': active,
      'is-locked': !chapter.unlocked,
      'is-complete': chapter.unlocked && chapter.completed >= chapter.total,
    }"
    :data-art-id="`body-chapter-seal-${chapter.id}`"
    :data-chapter="chapter.id"
    :aria-pressed="active"
    @click="emit('select', chapter.id)"
  >
    <img v-if="sealUrl" class="body-chapter-seal__art" :src="sealUrl" alt="" aria-hidden="true" />
    <span class="body-chapter-seal__seal" aria-hidden="true">{{ label.slice(0, 1) }}</span>
    <span class="body-chapter-seal__body">
      <span class="body-chapter-seal__name">{{ label }}</span>
      <span class="body-chapter-seal__sub">{{ subtitle }}</span>
      <span class="body-chapter-seal__state">{{ stateLabel }}</span>
    </span>
  </button>
</template>

<style scoped>
.body-chapter-seal {
  position: relative;
  isolation: isolate;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--hk-radius-sm, 6px);
  background:
    linear-gradient(160deg, var(--hk-surface-raised, #141d18) 0%, var(--hk-surface-base, #0b0f0d) 100%);
  color: var(--hk-text-secondary, #b8ae97);
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;
  transition: border-color 150ms ease, filter 150ms ease;
}
.body-chapter-seal__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  opacity: 0.55;
  pointer-events: none;
}
.body-chapter-seal__seal {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--hk-border-ceremony, #b99a55);
  background: radial-gradient(circle at 35% 30%, #22322b 0%, #101718 70%);
  color: var(--hk-gold-radiant, #f4d98b);
  font-family: var(--font-display, serif);
  font-size: var(--text-md);
}
.body-chapter-seal__body {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.body-chapter-seal__name {
  font-weight: 700;
  font-size: var(--text-sm);
  color: var(--hk-text-primary, #ede6d6);
  font-family: var(--font-display, serif);
}
.body-chapter-seal__sub,
.body-chapter-seal__state {
  font-size: var(--text-xs);
  color: var(--hk-text-muted, #7a7260);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.body-chapter-seal__state {
  font-variant-numeric: tabular-nums;
}

.body-chapter-seal:hover { border-color: var(--hk-border-active, #7a6234); }

.body-chapter-seal.is-active {
  border-color: var(--hk-gold, #b99a55);
  filter: drop-shadow(0 0 6px var(--hk-glow-gold, rgba(232, 195, 90, 0.35)));
}
.body-chapter-seal.is-active .body-chapter-seal__name {
  color: var(--hk-gold-radiant, #f4d98b);
}

.body-chapter-seal.is-locked {
  border-style: dashed;
}
.body-chapter-seal.is-locked .body-chapter-seal__seal {
  border-color: var(--hk-ink, #5b6266);
  color: var(--hk-ink, #5b6266);
}
.body-chapter-seal.is-locked .body-chapter-seal__name {
  color: var(--hk-ink, #5b6266);
}

.body-chapter-seal.is-complete .body-chapter-seal__state {
  color: var(--hk-jade, #3fa68b);
}
</style>
