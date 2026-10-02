<script setup lang="ts">
// Thien Co collapsed chip (scene 03 spec region `thien-co-collapsed`):
// the bottom-right pill that opens the opportunity drawer. Always
// rendered; the count badge mirrors the live entry count. Temporary CSS
// art pending a dedicated chip treatment (art inventory 03-dong-fu).
import { useI18n } from 'vue-i18n'

defineProps<{
  open: boolean
  count: number
}>()

const emit = defineEmits<{
  toggle: []
}>()

const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="thien-co-rail__chip"
    :aria-expanded="open"
    :aria-label="t('home.thienCo.aria')"
    art-needed
    data-art-id="thien-co-chip"
    @click="emit('toggle')"
  >
    <span class="thien-co-rail__seal" aria-hidden="true">✦</span>
    <span class="thien-co-rail__chip-title">{{ t('home.thienCo.title') }}</span>
    <span v-if="count > 0" class="thien-co-rail__count">{{ count }}</span>
  </button>
</template>

<style scoped>
.thien-co-rail__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--hk-space-2, 6px);
  /* Spec thien-co-collapsed 1388/856/268/52: 16.03% of the 1672 design
     width, 5.53% of the 941 design height. */
  width: 16.03vw;
  height: 5.53vh;
  box-sizing: border-box;
  padding: var(--hk-space-2, 6px) var(--hk-space-4, 12px);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: 999px;
  background: color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 78%, transparent);
  box-shadow: 0 8px 24px var(--hk-shadow-low, rgba(0, 0, 0, 0.4));
  color: var(--hk-text-primary, #ede6d6);
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.thien-co-rail__chip:hover,
.thien-co-rail__chip:focus-visible {
  border-color: var(--hk-border-active, #7a6234);
}

.thien-co-rail__chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--hk-glow-gold, rgba(232, 195, 90, 0.35));
}

.thien-co-rail__chip-title {
  font-family: var(--hk-font-display, serif);
  font-size: var(--text-xs, 11px);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--hk-gold, #c99a4a);
  white-space: nowrap;
}

.thien-co-rail__count {
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--hk-cinnabar, #b54432);
  color: var(--hk-text-primary, #ede6d6);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.thien-co-rail__seal {
  color: var(--hk-gold, #c99a4a);
  font-size: var(--text-sm, 12px);
  line-height: 1;
}
</style>
