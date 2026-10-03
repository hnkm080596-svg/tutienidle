<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import InkNineSlice from './InkNineSlice.vue'
import { AudioManager } from '@/core/audio/AudioManager'
// Primitive pill chon duoc - atom cho TabBar va moi filter/mode switcher.
// Cong thuc chuan: idle paper-200 (du toi de phan biet trang giay phia
// sau, khong con khoi muc den); active noi bat han bang vien dong
// --mineral-gold + nen paper sang nhat, khong hoa lan nen panel. Nen
// active dieu khien qua CSS var --chip-active-bg (noi can tint thi
// override).
//
// Huyen Kim phase 1: the seal-chip manifest slot carries the chrome;
// --chip-active-bg stays the consumer override and now paints the slice
// fill so a ready art drop cannot bury it.
const props = withDefaults(defineProps<{
  active?: boolean
  disabled?: boolean
}>(), {
  active: false,
  disabled: false,
})

// R11 (AR-28) - selection semantics: a Chip under role="tab" (TabBar) lets
// the tab role carry aria-selected; everywhere else it is a toggle, so
// active maps to aria-pressed.
const attrs = useAttrs()
const isTab = computed(() => attrs.role === 'tab')

// W7: blanket ui.tab on every Chip click (tabs, filters, toggles) -
// AudioManager direct, like GameButton, so chips work without Pinia
// (documented exception to the W7 useAudioStore().cue rule).
// Disabled buttons never fire click, so disabled chips stay silent.
const audio = AudioManager.getInstance()

function onClick() {
  audio.unlock()
  audio.playCue('ui.tab')
}
</script>

<template>
  <button
    type="button"
    class="chip"
    :class="{ 'is-active': active }"
    :disabled="disabled"
    :aria-pressed="isTab ? undefined : active"
    @click="onClick"
  >
    <InkNineSlice
      :chrome-id="isTab ? 'tab-seal' : 'seal-chip'"
      layer="frame"
      :tint-var="active ? 'var(--chip-active-bg, var(--hk-gold))' : undefined"
    />
    <span class="chip__content"><slot /></span>
  </button>
</template>

<style scoped>
.chip {
  position: relative;
  isolation: isolate;
  min-height: var(--hk-density-compact-height);
  padding: var(--hk-density-compact-pad-y) var(--hk-density-compact-pad-x);
  color: var(--hk-text-secondary);
  border: 0;
  border-radius: var(--hk-radius-pill);
  font-family: var(--hk-font-ui);
  font-weight: 600;
  font-size: var(--text-xs);
  cursor: pointer;
  background: transparent;
  transition: border-color var(--hk-motion-micro) var(--hk-ease-standard), color var(--hk-motion-micro) var(--hk-ease-standard), background var(--hk-motion-micro) var(--hk-ease-standard), box-shadow var(--hk-motion-micro) var(--hk-ease-standard);
}

.chip:not(.is-active):not(:disabled):hover {
  color: var(--hk-text-primary);
}

/* "Open" tab - brightest in the group + gold seal ring, lifted clear off
   the panel background instead of blending into the page color. */
.chip.is-active {
  color: var(--hk-text-primary);
  box-shadow:
    0 0 8px color-mix(in srgb, var(--hk-glow-gold) 60%, transparent),
    0 2px 6px var(--hk-shadow-low);
}

/* The slice paints the idle fill; --chip-active-bg remains the consumer
   override for the open state (SettingsPanel/StageSelectPanel tints). */
.chip :deep(.ink-nine-slice--hk-fill) {
  background: linear-gradient(175deg, var(--hk-surface-overlay), var(--hk-surface-raised));
}

.chip.is-active :deep(.ink-nine-slice--hk-fill) {
  background: var(--chip-active-bg, linear-gradient(175deg,
    color-mix(in srgb, var(--hk-gold) 30%, var(--hk-surface-overlay)),
    color-mix(in srgb, var(--hk-gold) 16%, var(--hk-surface-raised))));
}

.chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--hk-gold-muted), 0 0 10px var(--hk-glow-gold);
}

.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .chip {
    transition: none;
  }
}

.chip__content {
  position: relative;
  z-index: 3;
}
</style>
