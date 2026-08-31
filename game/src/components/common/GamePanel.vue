<script setup lang="ts">
import { computed } from 'vue'
import InkNineSlice from './primitives/InkNineSlice.vue'
// Shared chrome primitive (UI/UX rework Giai đoạn A) — thay thế pattern
// hand-roll background/border/box-shadow lặp lại ở mỗi panel
// (CharacterPanel/EquipmentHallPanel/...). variant="ornate" dùng
// "Ornate Ink Frame" — overlay .ornate-frame định nghĩa MỘT LẦN trong
// assets/theme.css (token --frame-*), không cần asset PNG, xem
// docs plan UI/UX rework mục Giai đoạn B cho Asset Spec bổ sung sau này.
const props = withDefaults(defineProps<{
  title?: string
  variant?: 'default' | 'compact' | 'ornate'
  padding?: 'none' | 'sm' | 'md'
}>(), {
  title: undefined,
  variant: 'default',
  padding: 'md',
})

const surfaceAsset = computed(() => (
  props.variant === 'ornate' ? 'surface-xl-paper-scroll' as const : 'surface-m-paper' as const
))
const frameAsset = computed(() => (
  props.variant === 'ornate' ? 'frame-xl-ceremony' as const : 'frame-l-landscape' as const
))
</script>

<template>
  <section class="game-panel" :class="[`game-panel--${variant}`, `game-panel--padding-${padding}`]">
    <!-- Khung vàng ornate = overlay .ornate-frame (theme.css), vẽ TRÊN
         nội dung nên nền opaque của child không che được viền. -->
    <InkNineSlice :asset-id="surfaceAsset" layer="surface" />
    <InkNineSlice :asset-id="frameAsset" layer="frame" />

    <header v-if="title" class="game-panel__header">
      <h3 class="game-panel__title">{{ title }}</h3>
      <div v-if="$slots['header-actions']" class="game-panel__header-actions">
        <slot name="header-actions" />
      </div>
    </header>

    <div class="game-panel__body"><slot /></div>
  </section>
</template>

<style scoped>
.game-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  isolation: isolate;
  color: var(--surface-text);
  font-family: var(--font-body);
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.game-panel--compact {
  border-radius: var(--radius-sm);
}

/* "Ornate Ink Frame" — ring + corner do overlay .ornate-frame (theme.css)
   vẽ; section chỉ giữ nền gradient mực và bỏ border riêng để khung vàng
   ôm sát mép ngoài cùng. */
.game-panel--ornate {
  background: transparent;
  border: 0;
  box-shadow: var(--shadow-panel);
}

.game-panel__header {
  position: relative;
  z-index: 3;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--surface-line);
}

.game-panel__title {
  margin: 0;
  margin-right: auto;
  font-family: var(--font-display);
  font-size: var(--text-panel-title);
  font-weight: 700;
  color: var(--surface-text);
  letter-spacing: 0.04em;
}

.game-panel__header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.game-panel__body {
  position: relative;
  z-index: 3;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.game-panel--padding-sm .game-panel__body {
  padding: var(--space-2);
}

.game-panel--padding-md .game-panel__body {
  padding: var(--space-3) var(--space-4);
}
</style>
