<script setup lang="ts">
// Shared chrome primitive (UI/UX rework Giai đoạn A) — thay thế pattern
// hand-roll background/border/box-shadow lặp lại ở mỗi panel
// (CharacterPanel/EquipmentHallPanel/...). variant="ornate" dùng
// "Ornate Ink Frame" — overlay .ornate-frame định nghĩa MỘT LẦN trong
// assets/theme.css (token --frame-*), không cần asset PNG, xem
// docs plan UI/UX rework mục Giai đoạn B cho Asset Spec bổ sung sau này.
withDefaults(defineProps<{
  title?: string
  variant?: 'default' | 'compact' | 'ornate'
  padding?: 'none' | 'sm' | 'md'
}>(), {
  variant: 'default',
  padding: 'md',
})
</script>

<template>
  <section class="game-panel" :class="[`game-panel--${variant}`, `game-panel--padding-${padding}`]">
    <!-- Khung vàng ornate = overlay .ornate-frame (theme.css), vẽ TRÊN
         nội dung nên nền opaque của child không che được viền. -->
    <span v-if="variant === 'ornate'" class="ornate-frame" aria-hidden="true" />

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
  color: var(--text-primary);
  font-family: var(--font-body);
  background: linear-gradient(160deg, var(--ink-900), var(--ink-800));
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
}

.game-panel--compact {
  border-radius: var(--radius-sm);
}

/* "Ornate Ink Frame" — ring + corner do overlay .ornate-frame (theme.css)
   vẽ; section chỉ giữ nền gradient mực và bỏ border riêng để khung vàng
   ôm sát mép ngoài cùng. */
.game-panel--ornate {
  background: linear-gradient(160deg, var(--ink-950), var(--ink-800));
  border: 0;
  box-shadow: var(--shadow-panel);
}

.game-panel__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--ink-line);
}

.game-panel__title {
  margin: 0;
  margin-right: auto;
  font-family: var(--font-display);
  font-size: var(--text-panel-title);
  font-weight: 700;
  color: var(--chrome-100);
  letter-spacing: 0.04em;
}

.game-panel__header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.game-panel__body {
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
