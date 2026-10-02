<script setup lang="ts">
// Scene 09 scaffold - progress-footer region (spec 288/792/1244/56):
// zone completion bar "Tien Do Tham Hiem: {zone}" + "{done}/{total}"
// + milestone marks at 10/20/30. Audit: the chest visuals are RESERVED
// - generic tick marks only, no chest art.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  zoneName: string
  completed: number
  total: number
}>()

const { t } = useI18n()

const MILESTONES = [10, 20, 30]

const fillPercent = computed(() =>
  props.total > 0 ? Math.min(100, (props.completed / props.total) * 100) : 0,
)

const ticks = computed(() =>
  MILESTONES.filter(m => m < props.total).map(m => ({
    milestone: m,
    left: (m / props.total) * 100,
    reached: props.completed >= m,
  })),
)
</script>

<template>
  <footer class="stage-select__progress">
    <span class="stage-select__progress-title">
      {{ t('panels.stageSelect.progress.title', { zone: props.zoneName }) }}
    </span>
    <span class="stage-select__progress-count">{{ props.completed }}/{{ props.total }}</span>

    <div class="stage-select__progress-track art-needed" data-art-id="exploration-progress-track" role="progressbar" :aria-valuenow="props.completed" :aria-valuemax="props.total" aria-valuemin="0">
      <span
        class="stage-select__progress-fill art-needed"
        data-art-id="exploration-progress-fill"
        :style="{ width: `${fillPercent}%` }"
      />
      <span
        v-for="tick in ticks"
        :key="tick.milestone"
        class="stage-select__progress-tick"
        :class="{ 'is-reached': tick.reached }"
        :style="{ left: `${tick.left}%` }"
        :title="`${tick.milestone}`"
      />
    </div>
  </footer>
</template>

<style scoped>
.stage-select__progress {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-top: 1px solid var(--paper-line);
  background: color-mix(in srgb, var(--scene-portal-glow) 6%, var(--paper-100));
}

.stage-select__progress-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--paper-text);
  white-space: nowrap;
}

.stage-select__progress-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, #315f55 18%, var(--paper-50));
  color: color-mix(in srgb, #315f55 80%, var(--brush-950));
  font-size: var(--text-xs);
  font-weight: 700;
}

.stage-select__progress-track {
  position: relative;
  flex: 1;
  height: 12px;
  border: 1px solid color-mix(in srgb, var(--hk-gold, #b99a55) 50%, var(--paper-line));
  border-radius: 999px;
  background: color-mix(in srgb, var(--brush-950) 14%, var(--paper-100));
  overflow: visible;
}

.stage-select__progress-fill {
  position: absolute;
  inset: 1px auto 1px 1px;
  border-radius: 999px;
  background: linear-gradient(90deg, color-mix(in srgb, #315f55 80%, var(--paper-50)), #315f55);
  transition: width .4s ease;
}

.stage-select__progress-tick {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--hk-gold, #b99a55) 70%, var(--brush-950));
  background: var(--paper-100);
}

.stage-select__progress-tick.is-reached {
  background: var(--hk-gold, #b99a55);
}
</style>
