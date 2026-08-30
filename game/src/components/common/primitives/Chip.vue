<script setup lang="ts">
import InkNineSlice from './InkNineSlice.vue'
// Primitive pill chọn được — atom cho TabBar và mọi filter/mode switcher.
// Công thức chuẩn: idle paper-200 (đủ tối để phân biệt trang giấy phía
// sau, không còn khối mực đen); active nổi bật hẳn bằng viền đồng
// --mineral-gold + nền paper sáng nhất, không hoà lẫn nền panel. Nền
// active điều khiển qua CSS var --chip-active-bg (nơi cần tint thì
// override).
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
    <InkNineSlice
      asset-id="frame-xs-ink-line"
      layer="frame"
      :tint-var="active ? '--mineral-gold' : undefined"
    />
    <span class="chip__content"><slot /></span>
  </button>
</template>

<style scoped>
.chip {
  position: relative;
  isolation: isolate;
  min-height: var(--tap-min);
  padding: var(--space-1) var(--space-2);
  /* Tab "đóng" — giấy trầm hơn panel phía sau, không còn khối mực đen. */
  background: linear-gradient(160deg, var(--paper-200), var(--paper-100));
  color: var(--paper-text-soft);
  border: 1px solid var(--paper-line-soft);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--text-xs);
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}

.chip:not(.is-active):not(:disabled):hover {
  color: var(--paper-text);
  border-color: var(--paper-line);
}

/* Tab "mở" — sáng nhất trong nhóm + viền đồng, nổi hẳn khỏi nền panel
   thay vì hoà lẫn màu trang. */
.chip.is-active {
  background: var(--chip-active-bg, linear-gradient(175deg, var(--paper-50), #fffdf7));
  color: var(--ink-950);
  border-color: var(--mineral-gold);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--mineral-gold) 35%, transparent),
    0 2px 6px rgba(20, 16, 8, 0.14);
}

.chip:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-chrome);
}

.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chip__content {
  position: relative;
  z-index: 3;
}
</style>
