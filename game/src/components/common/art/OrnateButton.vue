<script setup lang="ts">
import { computed } from 'vue'
import { AudioManager } from '@/core/audio/AudioManager'
import { dialogArt } from './dialogArt'

// Whole-image ornate button (gold primary / dark secondary) sliced intact
// from ornate-ui-sheet - the art keeps its native aspect ratio, so callers
// size the button by HEIGHT and the width follows (inside OrnateDialog's
// actions row: height:100%). No nine-slice, no stretching.
const props = withDefaults(
  defineProps<{
    variant?: 'gold' | 'dark'
    type?: 'button' | 'submit'
    disabled?: boolean
    loading?: boolean
    sound?: boolean
  }>(),
  {
    variant: 'gold',
    type: 'button',
    disabled: false,
    loading: false,
    sound: true,
  },
)

const emit = defineEmits<{ click: [MouseEvent] }>()

// Pinia-free audio cue, same documented exception as GameButton.
const audio = AudioManager.getInstance()

const artUrl = computed(() => dialogArt(props.variant === 'gold' ? 'button-gold-v1' : 'button-dark-v1'))
const aspectRatio = computed(() => (props.variant === 'gold' ? '269 / 120' : '219 / 120'))

function handleClick(event: MouseEvent) {
  audio.unlock()
  if (props.sound) {
    audio.playCue('ui.click')
  }
  emit('click', event)
}
</script>

<template>
  <button
    class="ornate-button"
    :class="[`ornate-button--${variant}`, { 'is-loading': loading }]"
    :style="{ aspectRatio }"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="handleClick"
  >
    <img class="ornate-button__art" :src="artUrl" alt="" aria-hidden="true" draggable="false" />
    <span class="ornate-button__label"><slot /></span>
  </button>
</template>

<style scoped>
.ornate-button {
  position: relative;
  display: inline-grid;
  place-items: center;
  height: var(--ornate-button-h, 100%);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  user-select: none;
  transition:
    transform var(--hk-motion-micro) var(--hk-ease-standard),
    opacity var(--hk-motion-micro) var(--hk-ease-standard);
}

.ornate-button__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
}

/* The art carries a diamond ornament on its bottom edge, so the label
   sits slightly above the geometric center. */
.ornate-button__label {
  position: relative;
  max-width: 88%;
  transform: translateY(-12%);
  font-family: var(--hk-font-display);
  font-weight: 700;
  font-size: var(--ornate-button-label-size, min(4.2cqh, 2.1cqw, 26px));
  letter-spacing: 0.02em;
  line-height: 1.1;
  white-space: var(--ornate-button-wrap, nowrap);
  overflow: hidden;
  text-overflow: ellipsis;
}

.ornate-button--gold .ornate-button__label {
  color: #fff6dd;
  text-shadow:
    0 1px 2px rgba(74, 38, 0, 0.65),
    0 0 8px rgba(120, 60, 0, 0.35);
}

.ornate-button--dark .ornate-button__label {
  color: #f3e7c8;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}

.ornate-button:hover:not(:disabled) {
  transform: scale(1.045);
}

.ornate-button:active:not(:disabled) {
  transform: scale(0.96);
}

.ornate-button:disabled {
  opacity: 0.55;
  cursor: default;
}

.ornate-button:focus-visible {
  outline: 2px solid var(--hk-gold-bright, #e8b45a);
  outline-offset: 2px;
  border-radius: 10px;
}
</style>
