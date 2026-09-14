<script setup lang="ts">
import { computed, useAttrs } from 'vue'
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

// R11 (AR-28) — selection semantics: a Chip under role="tab" (TabBar) lets
// the tab role carry aria-selected; everywhere else it is a toggle, so
// active maps to aria-pressed.
const attrs = useAttrs()
const isTab = computed(() => attrs.role === 'tab')
</script>

<template>
  <button
    type="button"
    class="chip"
    :class="{ 'is-active': active }"
    :disabled="disabled"
    :aria-pressed="isTab ? undefined : active"
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

/* "Open" tab - brightest in the group + brass border, lifted clear off
   the panel background instead of blending into the page color.
   color-mix instead of hard hex + --paper-text keeps the chip correct
   when the drawer remaps paper -> surface (.ink-drawer). */
.chip.is-active {
  background: var(--chip-active-bg, linear-gradient(175deg, var(--paper-50), color-mix(in srgb, var(--paper-50) 82%, white)));
  color: var(--paper-text);
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
