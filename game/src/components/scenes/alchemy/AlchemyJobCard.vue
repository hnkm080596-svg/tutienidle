<script setup lang="ts">
// Scene 11 job-queue card (spec asset: list-row + entity-bar for the
// progress gauge). Real jobs only — fast-forward chip INVALID,
// paid-unlock slots INVALID.
import { useI18n } from 'vue-i18n'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'

defineProps<{
  jobId: string
  pillName: string
  progress: number
  remainingLabel: string
}>()
const emit = defineEmits<{ cancel: [jobId: string] }>()
const { t } = useI18n()
</script>

<template>
  <div class="alchemy-queue__job">
    <div class="alchemy-queue__job-head">
      <span class="alchemy-queue__job-name">{{ pillName }}</span>
      <span class="alchemy-queue__job-eta">{{ remainingLabel }}</span>
    </div>
    <Bar class="alchemy-queue__job-bar" :value="progress" :max="1" :height="5" />
    <GameButton variant="ghost" size="sm" class="alchemy-queue__job-cancel" @click="emit('cancel', jobId)">
      {{ t('alchemy.cancelJob') }}
    </GameButton>
  </div>
</template>

<style scoped>
.alchemy-queue__job {
  flex: 0 0 auto;
  width: 168px;
  padding: 6px 8px;
  border: 1px solid color-mix(in srgb, var(--scene-fire-accent) 30%, var(--paper-line));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--paper-50) 80%, var(--scene-fire-accent) 8%);
}
.alchemy-queue__job-head {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: var(--text-xs);
  margin-bottom: 4px;
}
.alchemy-queue__job-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.alchemy-queue__job-eta { color: var(--cinnabar); font-variant-numeric: tabular-nums; white-space: nowrap; }
.alchemy-queue__job-cancel { width: 100%; margin-top: 4px; font-size: 10px; }
</style>
