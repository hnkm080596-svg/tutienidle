<script setup lang="ts">
import { computed } from 'vue'
import { dialogArt } from './dialogArt'

// Ornate dialog shell composed from whole-component slices of the owner's
// ornate-ui-sheet (frame + crest title band + flame badge + diamond close).
// The frame keeps its native 778x625 aspect: the shell is a fixed-ratio box
// and every chrome element is sized in container units, so the composition
// stays proportional at any rendered width. Content taller than the body
// region scrolls inside it - the frame is never resized or distorted.
const props = withDefaults(
  defineProps<{
    title?: string
    titleId?: string
    badge?: 'alert' | 'info' | 'none'
    showClose?: boolean
    closeLabel?: string
    width?: string
  }>(),
  {
    title: undefined,
    titleId: undefined,
    badge: 'none',
    showClose: false,
    closeLabel: 'Đóng',
    width: undefined,
  },
)

const emit = defineEmits<{ close: [] }>()

const frameUrl = dialogArt('dialog-frame-ornate-v1')
const bannerUrl = dialogArt('title-banner-crest-v1')
const closeUrl = dialogArt('button-close-v1')
const badgeUrl = computed(() =>
  props.badge === 'alert'
    ? dialogArt('badge-alert-v1')
    : props.badge === 'info'
      ? dialogArt('badge-info-v1')
      : undefined,
)
const dialogStyle = computed(() => (props.width ? { width: props.width } : undefined))
</script>

<template>
  <div class="ornate-dialog" :style="dialogStyle" tabindex="-1">
    <img class="ornate-dialog__frame" :src="frameUrl" alt="" aria-hidden="true" draggable="false" />
    <div class="ornate-dialog__chrome">
      <header v-if="title" class="ornate-dialog__titleband">
        <img class="ornate-dialog__titleband-art" :src="bannerUrl" alt="" aria-hidden="true" draggable="false" />
        <h3 :id="titleId" class="ornate-dialog__title">{{ title }}</h3>
      </header>
      <img
        v-if="badgeUrl"
        class="ornate-dialog__badge"
        :src="badgeUrl"
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <div class="ornate-dialog__body"><slot /></div>
      <footer v-if="$slots.actions" class="ornate-dialog__actions"><slot name="actions" /></footer>
    </div>
    <button
      v-if="showClose"
      type="button"
      class="ornate-dialog__close"
      :aria-label="closeLabel"
      @click="emit('close')"
    >
      <img :src="closeUrl" alt="" aria-hidden="true" draggable="false" />
    </button>
  </div>
</template>

<style scoped>
.ornate-dialog {
  position: relative;
  isolation: isolate;
  width: min(560px, 94vw);
  aspect-ratio: 778 / 625;
  container-type: size;
  color: var(--paper-text, #302719);
  font-family: var(--hk-font-ui);
  outline: none;
}

.ornate-dialog__frame {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
}

.ornate-dialog__chrome {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Crest title band: the banner's own crest overlaps the frame crest, so
   the two ornaments read as one (same composition as the mock). */
.ornate-dialog__titleband {
  position: relative;
  flex: none;
  width: 58%;
  margin-top: 3.4%;
}

.ornate-dialog__titleband-art {
  display: block;
  width: 100%;
}

.ornate-dialog__title {
  position: absolute;
  left: 7%;
  right: 7%;
  top: 63%;
  transform: translateY(-50%);
  margin: 0;
  font-family: var(--hk-font-display);
  font-weight: 700;
  font-size: min(4.4cqh, var(--text-title));
  letter-spacing: 0.08em;
  line-height: 1.15;
  text-align: center;
  color: #3a2c14;
  text-shadow: 0 1px 0 rgba(255, 244, 214, 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ornate-dialog__badge {
  flex: none;
  height: 21cqh;
  margin-top: 1%;
  pointer-events: none;
  user-select: none;
}

/* Body region between badge and actions. Per owner ruling, overflow
   scrolls INSIDE the region - the frame's ratio is untouched. */
.ornate-dialog__body {
  flex: 1 1 auto;
  min-height: 0;
  width: 68%;
  margin-top: 0.8%;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(122, 90, 40, 0.45) transparent;
}

.ornate-dialog__body::-webkit-scrollbar {
  width: 6px;
}

.ornate-dialog__body::-webkit-scrollbar-thumb {
  background: rgba(122, 90, 40, 0.45);
  border-radius: 3px;
}

.ornate-dialog__actions {
  flex: none;
  height: var(--ornate-actions-h, 17cqh);
  margin-bottom: 0.8cqh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4cqw;
}

.ornate-dialog__close {
  position: absolute;
  top: 9.2%;
  right: 1.8%;
  z-index: 2;
  width: 9.4%;
  aspect-ratio: 103 / 105;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  transition: transform var(--hk-motion-micro) var(--hk-ease-standard);
}

.ornate-dialog__close img {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.ornate-dialog__close:hover {
  transform: scale(1.06);
}

.ornate-dialog__close:active {
  transform: scale(0.96);
}

.ornate-dialog__close:focus-visible {
  outline: 2px solid var(--hk-gold-bright, #e8b45a);
  outline-offset: 2px;
  border-radius: 10px;
}
</style>
