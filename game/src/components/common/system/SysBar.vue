<script setup lang="ts">
import { computed } from 'vue'

// System-readout progress bar (spec 5). Same aria contract as
// primitives/Bar.vue. Tone maps to --sys-bar-from/--sys-bar-to on the root;
// label text (not color) carries meaning (spec 7.3).
const props = withDefaults(defineProps<{
  value: number
  max: number
  height?: number
  tone?: 'cyan' | 'hp' | 'mp' | 'exp' | 'warn'
  label?: string
}>(), {
  height: 10,
  tone: 'cyan',
})

const TONES: Record<NonNullable<typeof props.tone>, [string, string]> = {
  cyan: ['var(--sys-cyan)', 'var(--sys-azure)'],
  hp: ['var(--sys-danger)', 'var(--sys-warn)'],
  mp: ['var(--sys-azure)', 'var(--sys-violet)'],
  exp: ['var(--sys-cyan)', 'var(--sys-success)'],
  warn: ['var(--sys-warn)', 'var(--sys-danger)'],
}

const percent = computed(() => {
  if (props.max <= 0) return 0
  return Math.min(100, Math.max(0, (props.value / props.max) * 100))
})
const toneVars = computed(() => TONES[props.tone])
</script>

<template>
  <div
    class="sys-bar"
    :style="{
      '--sys-bar-h': `${height}px`,
      '--sys-bar-from': toneVars[0],
      '--sys-bar-to': toneVars[1],
    }"
    role="progressbar"
    :aria-valuenow="value"
    :aria-valuemin="0"
    :aria-valuemax="max"
    :aria-label="label"
  >
    <div class="sys-bar__fill" :style="{ width: `${percent}%` }" />
    <span v-if="label" class="sys-bar__label">{{ label }}</span>
  </div>
</template>
