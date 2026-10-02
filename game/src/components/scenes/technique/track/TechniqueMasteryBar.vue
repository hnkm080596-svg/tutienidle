<script setup lang="ts">
import Bar from '@/components/common/primitives/Bar.vue'

// Rank-progress line under the grade chain: "Cảnh {grade} · Cấp {rank}"
// + bar + numeric value (mastery/max, or "Viên Mãn" tier when capped).
// All fields arrive pre-formatted/derived from the canonical model.
defineProps<{
  rankLine: string
  value: number
  max: number
  valueLabel: string
}>()
</script>

<template>
  <div class="technique-mastery-bar">
    <div class="technique-mastery-bar__line">
      <span class="technique-mastery-bar__rank">{{ rankLine }}</span>
      <span class="technique-mastery-bar__value">{{ valueLabel }}</span>
    </div>
    <Bar :value="value" :max="max" :height="6" />
  </div>
</template>

<style scoped>
.technique-mastery-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.technique-mastery-bar__line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--hk-space-3);
}

.technique-mastery-bar__rank {
  font-size: var(--text-sm);
  color: var(--hk-gold);
  font-weight: 600;
}

.technique-mastery-bar__value {
  font-size: var(--text-xs);
  color: var(--hk-text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
