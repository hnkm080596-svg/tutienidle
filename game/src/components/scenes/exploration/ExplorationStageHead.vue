<script setup lang="ts">
// Scene 09 scaffold - detail panel header: chapter eyebrow
// (Chuong N - realm), stage code + name (ref: "1-1 Suon Thanh Van"),
// stage description, and the locked-hint mapped from the model's
// disabledReason (never re-derived).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Stage } from '@/core/stage/Stage'
import type { StageSurfaceModel } from '@/core/game/GameManagerStageOps'
import { disabledReasonLabel } from './disabledReasonLabel'

const props = defineProps<{
  stage: Stage
  model: StageSurfaceModel | undefined
  chapterLabel: string
}>()

const { t } = useI18n()

const floor = computed(() => props.stage.floor ?? props.stage.requiredRealmLevel ?? 1)
const chapter = computed(() => props.stage.chapter ?? 1)
const lockedHint = computed(() =>
  props.model?.state === 'locked' ? disabledReasonLabel(props.model.disabledReason, t) : '',
)
</script>

<template>
  <header class="exploration-head">
    <small class="exploration-head__eyebrow">
      {{ t('panels.stageSelect.labels.chapterPrefix', { chapter }) }} · {{ props.chapterLabel }}
    </small>
    <h4 class="stage-select__title exploration-head__title">
      {{ chapter }}-{{ floor }} {{ props.stage.name }}
    </h4>
    <p class="stage-select__description">{{ props.stage.description }}</p>
    <p v-if="lockedHint" class="stage-select__locked-hint">{{ lockedHint }}</p>
  </header>
</template>

<style scoped>
.exploration-head { display: flex; flex-direction: column; gap: 4px; }

.exploration-head__eyebrow {
  color: color-mix(in srgb, var(--hk-gold, #b99a55) 80%, var(--paper-text));
  font-size: var(--text-xs);
  letter-spacing: .08em;
  text-transform: uppercase;
}

.exploration-head__title { margin: 0; }

.stage-select__description {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--paper-text-soft);
}

.stage-select__locked-hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--crimson);
}
</style>
