<script setup lang="ts">
// Primitive pill chọn được — atom cho TabBar và mọi filter/mode switcher.
// Công thức chuẩn: idle ink-800 + ink-line-soft + text-secondary; active
// viền --chrome-300 + chữ --chrome-100. Nền active điều khiển qua CSS var
// --chip-active-bg (default transparent; nơi cần tint thì override).
withDefaults(defineProps<{
  active?: boolean
  disabled?: boolean
}>(), {
  active: false,
  disabled: false,
})
</script>

<template>
  <button
    type="button"
    class="chip"
    :class="{ 'is-active': active }"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.chip {
  min-height: var(--tap-min);
  padding: var(--space-1) var(--space-2);
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease, background 150ms ease;
}

.chip.is-active {
  background: var(--chip-active-bg, transparent);
  border-color: var(--chrome-300);
  color: var(--chrome-100);
}

.chip:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-chrome);
}

.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
