<script setup lang="ts">
// Scene 08 figure-focus footer strip: "{chapter} - {unit} / have-need"
// progress bar matching the reference footer readout.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatNumber } from '@/core/format/NumberFormatter'
import type { BodyChapterModel, } from './useBodySceneModel'
import { BODY_CHAPTER_LABEL_KEYS } from './useBodySceneModel'
import type { BodyUnitView } from './bodySceneModel'

const props = defineProps<{
  chapter: BodyChapterModel
  unit: BodyUnitView | null
}>()

const { t } = useI18n()

const label = computed(() => {
  const base = t(BODY_CHAPTER_LABEL_KEYS[props.chapter.id])
  return props.unit ? `${base} - ${props.unit.title}` : base
})

const progress = computed(() => {
  if (props.unit?.progress) return props.unit.progress
  return { value: props.chapter.completed, max: Math.max(1, props.chapter.total) }
})

const percent = computed(() =>
  progress.value.max > 0
    ? Math.min(100, (progress.value.value / progress.value.max) * 100)
    : 0,
)
</script>

<template>
  <div class="body-progress" role="group" :aria-label="label">
    <span class="body-progress__badge art-needed" data-art-id="body-progress-badge">!</span>
    <div class="body-progress__body">
      <span class="body-progress__label">{{ label }}</span>
      <div class="body-progress__track art-needed" data-art-id="body-progress-track">
        <div class="body-progress__fill" :style="{ width: `${percent}%` }" />
      </div>
    </div>
    <span class="body-progress__value">
      {{ formatNumber(progress.value) }}/{{ formatNumber(progress.max) }}
    </span>
  </div>
</template>

<style scoped>
.body-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--hk-radius-md, 8px);
  border: 1px solid var(--hk-border-muted, #2a352f);
  background: color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 82%, transparent);
}
.body-progress__badge {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--hk-border-ceremony, #b99a55);
  background: radial-gradient(circle at 35% 30%, #2a2416 0%, var(--hk-surface-base, #0b0f0d) 75%);
  color: var(--hk-gold-radiant, #f4d98b);
  font-weight: 700;
}
.body-progress__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.body-progress__label {
  font-family: var(--font-display, serif);
  font-weight: 700;
  font-size: var(--text-sm);
  color: var(--hk-gold-radiant, #f4d98b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.body-progress__track {
  height: 8px;
  border-radius: 4px;
  border: 1px solid var(--hk-border-muted, #2a352f);
  background: var(--hk-surface-raised, #131b17);
  overflow: hidden;
}
.body-progress__fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--hk-jade, #3fa68b) 0%, var(--hk-gold-radiant, #f4d98b) 100%);
  transition: width 300ms ease;
}
.body-progress__value {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--hk-text-secondary, #b8ae97);
}
</style>
