<script setup lang="ts">
import { computed } from 'vue'
import InkNineSlice from './primitives/InkNineSlice.vue'
import type { InkWashUiAssetId } from '@/assets/inkWashUi'
import { AudioManager } from '@/core/audio/AudioManager'
// Shared chrome primitive (UI/UX rework phase A) — replaces hand-rolled
// buttons (each panel declaring its own background/color/border) with one
// component reusing the --gold/--jade/--crimson/--tap-* tokens in theme.css.
const props = withDefaults(defineProps<{
  // 'system' = M-UI-OVERHAUL chrome (chamfer + hairline + accent glow).
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'system'
  size?: 'sm' | 'md' | 'lg'
  shape?: 'rect' | 'circle'
  accentVar?: string
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  /** When false (default true), the button does NOT play uiClick on click. */
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
// mount in unit tests without an active Pinia. SettingsPanel and other
// components needing reactive state use useAudioStore for
// enabled + volume.
const audio = AudioManager.getInstance()

// Centralized click handler — plays uiClick SFX + unlocks the AudioContext
// on the first click (autoplay policy requires a user gesture). The real
// parent click still fires via emit('click').
function handleClick(event: MouseEvent) {
  audio.unlock()
  if (props.sound) {
    audio.play('uiClick')
  }
  emit('click', event)
}

const sliceAsset = computed<InkWashUiAssetId | undefined>(() => {
  // border-image (InkNineSlice) does not follow border-radius — circle
  // buttons use a plain CSS border (.game-button--circle) instead.
  if (props.shape === 'circle') return undefined
  // 'system' variant paints with CSS only (no nine-slice art).
  if (props.variant === 'system') return undefined
  switch (props.variant) {
    case 'secondary': return 'button-s-ink'
    case 'danger': return 'button-s-seal'
    case 'ghost': return 'frame-xs-ink-line'
    default: return 'button-s-paper'
  }
})

const sliceLayer = computed(() => (
  sliceAsset.value?.startsWith('frame-') ? 'frame' as const : 'surface' as const
))
const sliceTint = computed(() => (props.variant === 'danger' ? '--cinnabar' : undefined))
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
    <InkNineSlice v-if="sliceAsset" :asset-id="sliceAsset" :layer="sliceLayer" :tint-var="sliceTint" />
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
  gap: var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  transition: transform 120ms ease, opacity 120ms ease, color 120ms ease;
}

.game-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.game-button--sm {
  min-height: var(--tap-min);
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
}

.game-button--md {
  min-height: var(--tap-comfortable);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
}

.game-button--lg {
  min-height: calc(var(--tap-comfortable) + 8px);
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-body);
}

/* DARK MODE (2026-08-31) — nút trên nền tối */
.game-button--primary {
  color: var(--surface-text);
}

.game-button--primary:not(:disabled):hover {
  color: var(--chrome-100);
}

.game-button--secondary {
  color: var(--chrome-300);
}

.game-button--secondary:not(:disabled):hover {
  color: var(--chrome-100);
}

.game-button--danger {
  color: var(--chrome-100);
}

.game-button--danger:not(:disabled):hover {
  color: var(--chrome-300);
}

.game-button--ghost {
  color: var(--surface-text-soft);
}

.game-button--ghost:not(:disabled):hover {
  color: var(--surface-text);
}

.game-button:focus-visible {
  /* UI-001 (Task 1, 2026-09-07) — fallback ring khi token thiếu: không
     còn `outline: none` trần (mất focus indication hoàn toàn nếu
     --focus-ring-chrome undefined). */
  outline: 2px solid rgba(217, 212, 199, 0.65);
  outline-offset: 2px;
  outline-color: transparent;
  outline-style: solid;
  box-shadow: var(--focus-ring-chrome, 0 0 0 2px rgba(217, 212, 199, 0.65));
}

/* M-UI-SYSTEM: scoped-attribute specificity (0,3,0) beats the global sys
   focus rule (0,2,1), so the sys ring is re-declared here under sys
   anchors - same 2px non-glow contract, sys hue, no chrome shadow. */
.sys-surface .game-button:focus-visible,
.sys-modal .game-button:focus-visible,
.overlay-panel__card--system .game-button:focus-visible {
  outline-color: var(--sys-focus, rgba(217, 212, 199, 0.65));
  box-shadow: none;
}

/* M-UI-OVERHAUL: system-variant button - chamfered hairline console button.
   Scoped here (not in system-theme.css) so it composes with .game-button
   base sizing; reads --sys-* tokens, degrades to a bordered box without
   the sheet (fallback hexes mirror --sys-cyan/--sys-text). */
.game-button--system {
  --sys-btn-accent: var(--sys-accent, #38e1ff);
  border-radius: 0;
  font-family: var(--sys-font-display, var(--font-body));
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--sys-btn-accent);
  border: 1px solid color-mix(in srgb, var(--sys-btn-accent) 55%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--sys-btn-accent) 13%, transparent),
      color-mix(in srgb, var(--sys-btn-accent) 4%, transparent)),
    var(--sys-bg-0, #050a12);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.game-button--system:not(:disabled):hover,
.game-button--system:not(:disabled):focus-visible {
  color: var(--sys-text, #d8ecff);
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--sys-btn-accent) 55%, transparent));
}

/* System focus ring - 2px non-glow accent (spec 7.2). */
.game-button--system:focus-visible {
  outline: 2px solid var(--sys-focus, #8fe9ff);
  outline-offset: 2px;
  box-shadow: none;
}

/* Dạng tròn — nút icon (+/−). */
.game-button--circle {
  min-width: var(--tap-min);
  min-height: var(--tap-min);
  padding: 0;
  border: 1px solid var(--surface-line);
  border-radius: 50%;
}

.game-button--circle:not(:disabled):hover {
  border-color: var(--chrome-500);
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
  .game-button__spinner {
    animation: none;
  }
}

@keyframes game-button-spin {
  to { transform: rotate(360deg); }
}
</style>
