<script setup lang="ts">
import { computed } from 'vue'

// Primitive thanh fill ngang - nguon su that duy nhat cho moi progress bar
// cua app (tu vi, EXP, cycle, HP/MP, countdown...). Visual dieu khien qua
// CSS var: noi dung override `style="--bar-from: var(--el-color)"`.
// House style mac dinh: track --ink-700, fill gradient jade -> chrome-300.
const props = withDefaults(defineProps<{
  value: number
  max: number
  height?: number
  pill?: boolean
  anchor?: 'left' | 'right'
  // M-UI-SYSTEM: 'system' emits bar--system; its styles live only in
  // system-theme.css (spec 2.2-4). Default 'ink' keeps every caller identical.
  variant?: 'ink' | 'system'
}>(), {
  height: 8,
  pill: false,
  anchor: 'left',
  variant: 'ink',
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
    :class="{ 'bar--pill': pill, 'bar--anchor-right': anchor === 'right', 'bar--system': variant === 'system' }"
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
  border-radius: var(--hk-radius-sm);
  background: var(--bar-track, var(--hk-surface-base));
  box-shadow: inset 0 0 0 1px var(--hk-border-muted);
}

.bar--pill {
  border-radius: var(--hk-radius-pill);
}

.bar__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--bar-from, var(--hk-jade)), var(--bar-to, var(--hk-gold)));
  transition: width var(--hk-motion-micro) var(--hk-ease-standard);
}

@media (prefers-reduced-motion: reduce) {
  .bar__fill {
    transition: none;
  }
}

.bar--anchor-right .bar__fill {
  margin-left: auto;
}

/* M-UI-SYSTEM: tone remap for variant="system" - the same CSS-var
   mechanism ink callers already use; ink fallbacks keep the bar legible
   if the system layer is not imported (safe degrade, spec 2.3). Extras
   (border/shimmer/label font) stay anchored in system-theme.css. */
.bar--system {
  --bar-track: var(--sys-bg-0, var(--ink-700));
  --bar-from: var(--sys-cyan, var(--jade));
  --bar-to: var(--sys-azure, var(--chrome-300));
}

.bar__label {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  height: 100%;
  place-items: center;
  color: var(--hk-text-primary);
  font-size: var(--text-xs);
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  font-variant-numeric: tabular-nums;
}
</style>
