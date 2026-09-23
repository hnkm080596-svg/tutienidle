<script setup lang="ts">
// Status/rarity chip (spec 5). Bracketed uppercase label + a left glyph whose
// SHAPE varies per tone - meaning is never carried by hue alone (spec 7.3).
withDefaults(defineProps<{
  tone?: 'cyan' | 'violet' | 'warn' | 'danger' | 'success' | 'muted'
  icon?: string
}>(), {
  tone: 'cyan',
})
</script>

<template>
  <span class="sys-tag" :class="`sys-tag--${tone}`">
    <span class="sys-tag__glyph" aria-hidden="true" />
    <span v-if="icon" class="sys-tag__icon" aria-hidden="true">{{ icon }}</span>
    <span class="sys-tag__text"><slot /></span>
  </span>
</template>
