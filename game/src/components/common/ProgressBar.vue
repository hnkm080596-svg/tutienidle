<script setup lang="ts">
import { computed } from 'vue'

// Shared chrome primitive (UI/UX rework Giai đoạn A) — thay các bar
// hand-roll rải rác (Character/Cảnh Giới/Building...) bằng 1 component
// dùng chung, vẫn nhận value/max thật từ caller (không tự bịa %).
const props = withDefaults(defineProps<{
  value: number
  max: number
  variant?: 'gold' | 'jade' | 'crimson' | 'azure'
  showLabel?: boolean
}>(), {
  variant: 'gold',
  showLabel: false,
})

const percent = computed(() => {
  if (props.max <= 0) {
    return 0
  }

  return Math.min(100, Math.max(0, (props.value / props.max) * 100))
})
</script>

<template>
  <div
    class="progress-bar"
    :class="[`progress-bar--${variant}`, { 'progress-bar--labeled': showLabel }]"
    role="progressbar"
    :aria-valuenow="value"
    :aria-valuemin="0"
    :aria-valuemax="max"
  >
    <div class="progress-bar__fill" :style="{ width: `${percent}%` }" />
    <span v-if="showLabel" class="progress-bar__label">{{ Math.round(percent) }}%</span>
  </div>
</template>

<style scoped>
.progress-bar {
  position: relative;
  width: 100%;
  height: 10px;
  overflow: hidden;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: 999px;
}

.progress-bar--labeled {
  height: 14px;
}

.progress-bar__fill {
  height: 100%;
  border-radius: inherit;
  transition: width 200ms ease;
}

.progress-bar--gold .progress-bar__fill {
  background: linear-gradient(90deg, var(--chrome-100), var(--chrome-500));
  box-shadow: var(--shadow-glow-chrome);
}

.progress-bar--jade .progress-bar__fill {
  background: var(--jade);
}

.progress-bar--crimson .progress-bar__fill {
  background: var(--crimson);
}

.progress-bar--azure .progress-bar__fill {
  background: var(--azure);
}

.progress-bar__label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
</style>
