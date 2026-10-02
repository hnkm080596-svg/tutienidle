<script setup lang="ts">
// Scene 11 job-queue region (spec: 288/724/824/118, list family;
// slots = maxJobSlots from the pill_room building — no fast-forward,
// no paid unlock). Shows the canonical "Hàng Chờ (n/m)" capacity the
// ref's "Hàng Chờ Luyện Đan (3/4)" implies.
import { useI18n } from 'vue-i18n'
import AlchemyJobCard from './AlchemyJobCard.vue'

export interface AlchemyJobRow {
  jobId: string
  pillName: string
  progress: number
  remainingLabel: string
}

defineProps<{
  jobs: AlchemyJobRow[]
  maxJobSlots: number
}>()
const emit = defineEmits<{ cancel: [jobId: string] }>()
const { t } = useI18n()
</script>

<template>
  <div class="alchemy-queue-region" data-hk-region="job-queue">
    <p class="alchemy-queue-region__title">
      {{ t('alchemy.queueTitle') }}
      <span class="alchemy-queue-region__count">({{ jobs.length }}/{{ Math.max(1, maxJobSlots) }})</span>
    </p>

    <div class="alchemy-queue" :aria-label="t('alchemy.jobs')">
      <AlchemyJobCard
        v-for="job in jobs"
        :key="job.jobId"
        v-bind="job"
        @cancel="emit('cancel', $event)"
      />
      <p v-if="jobs.length === 0" class="alchemy-queue-region__empty">{{ t('alchemy.queueEmpty') }}</p>
    </div>
  </div>
</template>

<style scoped>
.alchemy-queue-region {
  grid-area: queue;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid color-mix(in srgb, var(--scene-fire-accent) 35%, var(--paper-line));
  background: color-mix(in srgb, var(--scene-fire-accent) 7%, var(--paper-100));
}
.alchemy-queue-region__title {
  margin: 0;
  padding: 6px 12px 0;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  color: var(--paper-text);
}
.alchemy-queue-region__count { color: var(--cinnabar); font-variant-numeric: tabular-nums; }
.alchemy-queue {
  flex: 1 1 auto;
  display: flex;
  gap: 8px;
  align-items: flex-start;
  overflow-x: auto;
  padding: 6px 10px;
  scrollbar-width: none;
}
.alchemy-queue::-webkit-scrollbar { display: none; }
.alchemy-queue-region__empty {
  margin: 6px 0;
  font-size: var(--text-xs);
  color: var(--paper-text-muted);
  font-style: italic;
}
</style>
