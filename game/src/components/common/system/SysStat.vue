<script setup lang="ts">
// Stat readout row (spec 5) - mirrors primitives/StatRow.vue's contract for
// drop-in feel: muted label, tabular-nums value in the display font.
withDefaults(defineProps<{
  label: string
  tone?: 'default' | 'positive' | 'negative' | 'warn' | 'muted'
  bordered?: boolean
}>(), {
  tone: 'default',
  bordered: false,
})
</script>

<template>
  <li class="sys-stat" :class="[{ 'sys-stat--bordered': bordered }, `sys-stat--${tone}`]">
    <span class="sys-stat__label">{{ label }}</span>
    <span class="sys-stat__value"><slot /></span>
  </li>
</template>
