<script setup lang="ts">
import { computed, useAttrs } from 'vue'
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
  background: linear-gradient(160deg, var(--sys-bg-1, var(--paper-200)), var(--sys-bg-1, var(--paper-100)));
  color: var(--sys-text-muted, var(--paper-text-soft));
  border: 1px solid var(--sys-line-soft, var(--paper-line-soft));
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
  font-family: var(--sys-font-body, var(--font-body));
  font-weight: 600;
  font-size: var(--text-xs);
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}

.chip:not(.is-active):not(:disabled):hover {
  color: var(--sys-text, var(--paper-text));
  border-color: var(--sys-line-soft, var(--paper-line));
}

/* "Open" tab - brightest in the group + brass border, lifted clear off
   the panel background instead of blending into the page color.
   color-mix instead of hard hex + --paper-text keeps the chip correct
   when the drawer remaps paper -> surface (.ink-drawer). */
.chip.is-active {
  background: var(--chip-active-bg, linear-gradient(175deg, var(--sys-bg-0, var(--paper-50)), color-mix(in srgb, var(--sys-bg-0, var(--paper-50)) 82%, white)));
  color: var(--sys-text, var(--paper-text));
  border-color: var(--sys-accent, var(--mineral-gold));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--sys-accent, var(--mineral-gold)) 35%, transparent),
    inset 0 -6px 12px -8px rgba(20, 16, 8, 0.25);
}

.chip:focus-visible {
  outline: 2px solid var(--sys-focus, rgba(217, 212, 199, 0.85));
  outline-offset: -2px;
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
