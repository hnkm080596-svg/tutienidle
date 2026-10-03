<script setup lang="ts">
// Huyen Kim Son Thuy SS18 (Dao Quyen) - 10 runes orbiting the active
// technique; lit runes carry the current rank. Pure presentation: the
// text rank label beside it stays the accessible read (aria-hidden).
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  lit: number
  total?: number
}>(), {
  total: 10,
})

interface RuneDot {
  x: number
  y: number
  lit: boolean
}

const runes = computed<RuneDot[]>(() => {
  const radius = 44

  return Array.from({ length: props.total }, (_, index) => {
    const angle = (index / props.total) * Math.PI * 2 - Math.PI / 2

    return {
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      lit: index < props.lit,
    }
  })
})
</script>

<template>
  <svg class="rune-ring" viewBox="0 0 100 100" aria-hidden="true">
    <circle
      v-for="(rune, index) in runes"
      :key="index"
      :cx="rune.x"
      :cy="rune.y"
      r="4"
      class="rune-ring__rune"
      :class="{ 'is-lit': rune.lit }"
    />
  </svg>
</template>

<style scoped>
.rune-ring {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.rune-ring__rune {
  fill: none;
  stroke: var(--hk-border-muted, #2a352f);
  stroke-width: 1.4;
}

.rune-ring__rune.is-lit {
  fill: var(--hk-gold, #c99a4a);
  stroke: var(--hk-gold-bright, #e8c35a);
  filter: drop-shadow(0 0 2px var(--hk-glow-gold, rgba(232, 195, 90, 0.35)));
}
</style>
