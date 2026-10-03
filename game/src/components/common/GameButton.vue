<script setup lang="ts">
import { computed } from 'vue'
import InkNineSlice from './primitives/InkNineSlice.vue'
import { AudioManager } from '@/core/audio/AudioManager'
// Shared chrome primitive (UI/UX rework phase A) — replaces hand-rolled
// buttons (each panel declaring its own background/color/border) with one
// component reusing the --gold/--jade/--crimson/--tap-* tokens in theme.css.
//
// Huyen Kim phase 1: chrome comes from the huyen-kim manifest button-*
// slots (size -> compact/standard/ceremonial) with --hk-* token fallbacks
// while the art stays 'pending'.
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  shape?: 'rect' | 'circle'
  accentVar?: string
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  /** When false (default true), the button does NOT play ui.click on click. */
  sound?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  shape: 'rect',
  accentVar: undefined,
  disabled: false,
  loading: false,
  type: 'button',
  sound: true,
})

const emit = defineEmits<{ click: [MouseEvent] }>()

// Direct AudioManager singleton (not the Pinia store) so GameButton can
// mount in unit tests without an active Pinia - documented exception to
// the W7 useAudioStore().cue rule for Pinia-free primitives.
const audio = AudioManager.getInstance()

// Centralized click handler - plays ui.click SFX + unlocks the AudioContext
// on the first click (autoplay policy requires a user gesture). The real
// parent click still fires via emit('click').
function handleClick(event: MouseEvent) {
  audio.unlock()
  if (props.sound) {
    audio.playCue('ui.click')
  }
  emit('click', event)
}

const CHROME_SLOT_BY_SIZE = {
  sm: 'button-compact',
  md: 'button-standard',
  lg: 'button-ceremonial',
} as const

const chromeSlot = computed(() => {
  // ghost stays a bare hairline frame on the element itself. Circle maps
  // to the icon-button-utility seal slot (the pending --hk-* fallback
  // rounds via border-radius: inherit like every other slice).
  if (props.variant === 'ghost') return undefined
  if (props.shape === 'circle') return 'icon-button-utility'
  return CHROME_SLOT_BY_SIZE[props.size]
})

const sliceTint = computed(() => {
  switch (props.variant) {
    case 'danger': return '--hk-cinnabar'
    case 'primary': return '--hk-gold'
    default: return undefined
  }
})
</script>

<template>
  <button
    :type="type"
    class="game-button"
    :class="[`game-button--${variant}`, `game-button--${size}`, `game-button--${shape}`, { 'is-loading': loading, 'has-accent': accentVar !== undefined }]"
    :style="accentVar ? { '--button-accent': accentVar } : undefined"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="handleClick"
  >
    <InkNineSlice v-if="chromeSlot" :chrome-id="chromeSlot" layer="surface" :tint-var="sliceTint" />
    <span v-if="loading" class="game-button__spinner" aria-hidden="true" />
    <span class="game-button__label"><slot /></span>
  </button>
</template>

<style scoped>
.game-button {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--hk-space-2);
  border: 0;
  border-radius: var(--hk-radius-sm);
  font-family: var(--hk-font-ui);
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  transition: transform var(--hk-motion-micro) var(--hk-ease-standard), opacity var(--hk-motion-micro) var(--hk-ease-standard), color var(--hk-motion-micro) var(--hk-ease-standard);
}

.game-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.game-button--sm {
  min-height: var(--hk-density-compact-height);
  padding: var(--hk-density-compact-pad-y) var(--hk-density-compact-pad-x);
  font-size: var(--text-xs);
}

.game-button--md {
  min-height: var(--hk-density-standard-height);
  padding: var(--hk-density-standard-pad-y) var(--hk-density-standard-pad-x);
  font-size: var(--text-sm);
}

.game-button--lg {
  min-height: var(--hk-density-ceremonial-height);
  padding: var(--hk-density-ceremonial-pad-y) var(--hk-density-ceremonial-pad-x);
  font-size: var(--text-body);
}

/* DARK MODE (2026-08-31) — nút trên nền tối */
.game-button--primary {
  color: var(--hk-text-primary);
}

.game-button--primary:not(:disabled):hover {
  color: var(--hk-gold-bright);
}

.game-button--secondary {
  color: var(--hk-text-secondary);
}

.game-button--secondary:not(:disabled):hover {
  color: var(--hk-text-primary);
}

.game-button--danger {
  color: var(--hk-text-primary);
}

.game-button--danger:not(:disabled):hover {
  color: var(--hk-cinnabar-bright);
}

.game-button--ghost {
  color: var(--hk-text-secondary);
  border: 1px solid var(--hk-border-muted);
  transition: transform var(--hk-motion-micro) var(--hk-ease-standard), opacity var(--hk-motion-micro) var(--hk-ease-standard), color var(--hk-motion-micro) var(--hk-ease-standard), border-color var(--hk-motion-micro) var(--hk-ease-standard);
}

.game-button--ghost:not(:disabled):hover {
  color: var(--hk-text-primary);
  border-color: var(--hk-border-active);
}

.game-button:focus-visible {
  /* UI-001 (Task 1, 2026-09-07) — fallback ring khi token thiếu: không
     còn `outline: none` trần (mất focus indication hoàn toàn nếu
     --focus-ring-chrome undefined). */
  outline: 2px solid rgba(217, 212, 199, 0.65);
  outline-offset: 2px;
  outline-color: transparent;
  outline-style: solid;
  box-shadow: 0 0 0 2px var(--hk-gold-muted), 0 0 10px var(--hk-glow-gold);
}

/* M-UI-SYSTEM: scoped-attribute specificity (0,3,0) beats the global sys
   focus rule (0,2,1), so the sys ring is re-declared here under sys
   anchors - same 2px non-glow contract, sys hue, no chrome shadow. */
.sys-surface .game-button:focus-visible,
.overlay-panel__card--system .game-button:focus-visible {
  outline-color: var(--sys-focus, rgba(217, 212, 199, 0.65));
  box-shadow: none;
}

/* Circle icon buttons. The element border is the fallback when no slice
   is mounted (ghost-circle); a mounted chrome slice owns the ring. */
.game-button--circle {
  min-width: var(--hk-density-compact-height);
  min-height: var(--hk-density-compact-height);
  padding: 0;
  border: 0;
  border-radius: 50%;
}

.game-button--circle:not(:has(> .ink-nine-slice)) {
  border: 1px solid var(--hk-border-muted);
}

.game-button--circle:not(:disabled):hover {
  border-color: var(--hk-border-active);
}

.game-button:not(:disabled):active {
  transform: translateY(1px);
}

.game-button:not(:disabled):active :deep(.ink-nine-slice) {
  opacity: 0.82 !important;
}

/* Accent động theo scene — fill đổ gradient từ 1 CSS var của nơi dùng
   (ví dụ accentVar="--scene-fire-text" cho lò đan). */
.game-button--primary.has-accent {
  color: var(--button-accent);
}

.game-button__label,
.game-button__spinner {
  position: relative;
  z-index: 3;
}

.game-button__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: game-button-spin 0.6s linear infinite;
}

/* UI-006 (Task 1) — reduced motion: spinner đứng yên, không quay. */
@media (prefers-reduced-motion: reduce) {
  .game-button,
  .game-button--ghost {
    transition: none;
  }

  .game-button__spinner {
    animation: none;
  }
}

@keyframes game-button-spin {
  to { transform: rotate(360deg); }
}
</style>
