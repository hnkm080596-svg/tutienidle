<script setup lang="ts">
import { computed } from 'vue'
import InkNineSlice from './primitives/InkNineSlice.vue'
import type { InkWashUiAssetId } from '@/assets/inkWashUi'
import { AudioManager } from '@/core/audio/AudioManager'
// Shared chrome primitive (UI/UX rework Giai đoạn A) — thay button
// hand-roll (mỗi panel tự khai background/color/border riêng) bằng 1
// component dùng chung, tái dùng token --gold/--jade/--crimson/--tap-*
// có sẵn trong theme.css.
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  shape?: 'rect' | 'circle'
  accentVar?: string
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  /** Khi false (mặc định true), button KHÔNG kêu uiClick khi click. */
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

// Dùng AudioManager singleton trực tiếp (không qua Pinia store) để
// GameButton mount được trong test đơn vị mà không cần setup Pinia
// active. SettingsPanel + components cần reactive state sẽ dùng
// useAudioStore để đọc/ghi enabled + volume.
const audio = AudioManager.getInstance()

// Centralized click handler — phát uiClick SFX + unlock AudioContext lần
// đầu (autoplay policy yêu cầu user gesture). Click thật của component
// cha vẫn được phát ra qua emit('click').
function handleClick(event: MouseEvent) {
  audio.unlock()
  if (props.sound) {
    audio.play('uiClick')
  }
  emit('click', event)
}

const sliceAsset = computed<InkWashUiAssetId | undefined>(() => {
  // border-image (InkNineSlice) không theo border-radius — nút circle
  // dùng viền CSS thường (.game-button--circle) thay vì asset chữ nhật.
  if (props.shape === 'circle') return undefined
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
  outline: none;
  box-shadow: var(--focus-ring-chrome);
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

@keyframes game-button-spin {
  to { transform: rotate(360deg); }
}
</style>
