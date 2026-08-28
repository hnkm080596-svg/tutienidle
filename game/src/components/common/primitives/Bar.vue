<script setup lang="ts">
import { computed } from 'vue'

// Primitive thanh fill ngang — nguồn sự thật duy nhất cho mọi progress bar
// của app (tu vi, EXP, cycle, HP/MP, countdown...). Visual điều khiển qua
// CSS var: nơi dùng override `style="--bar-from: var(--el-color)"`.
// House style mặc định: track --ink-700, fill gradient jade → chrome-300.
const props = withDefaults(defineProps<{
  value: number
  max: number
  height?: number
  pill?: boolean
  anchor?: 'left' | 'right'
}>(), {
  height: 8,
  pill: false,
  anchor: 'left',
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
    class="bar"
    :class="{ 'bar--pill': pill, 'bar--anchor-right': anchor === 'right' }"
    :style="{ '--bar-height': `${height}px` }"
    role="progressbar"
    :aria-valuenow="value"
    :aria-valuemin="0"
    :aria-valuemax="max"
  >
    <div class="bar__fill" :style="{ width: `${percent}%` }" />
    <span v-if="$slots.label" class="bar__label"><slot name="label" /></span>
  </div>
</template>

<style scoped>
.bar {
  position: relative;
  width: 100%;
  height: var(--bar-height, 8px);
  overflow: hidden;
  background: var(--bar-track, var(--ink-700));
}

.bar--pill {
  border-radius: 999px;
}

.bar__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--bar-from, var(--jade)), var(--bar-to, var(--chrome-300)));
  transition: width 200ms ease;
}

.bar--anchor-right .bar__fill {
  margin-left: auto;
}

.bar__label {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  height: 100%;
  place-items: center;
  color: var(--text-primary);
  font-size: var(--text-xs);
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  font-variant-numeric: tabular-nums;
}
</style>
