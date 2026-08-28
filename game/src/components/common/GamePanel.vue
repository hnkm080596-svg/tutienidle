<script setup lang="ts">
// Shared chrome primitive (UI/UX rework Giai đoạn A) — thay thế pattern
// hand-roll background/border/box-shadow lặp lại ở mỗi panel
// (CharacterPanel/EquipmentHallPanel/...). variant="ornate" dùng
// "Ornate Ink Frame" thuần CSS (double-border qua box-shadow chồng lớp +
// corner accent qua pseudo-element) — không cần asset PNG, xem
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

/* "Ornate Ink Frame" — double-border bằng box-shadow chồng lớp (không
   thêm DOM) + 2 góc "khung triện" qua pseudo-element, tái dùng token
   vàng/mực có sẵn, không cần asset. */
.game-panel--ornate {
  background: linear-gradient(160deg, var(--ink-950), var(--ink-800));
  border-color: transparent;
  box-shadow:
    var(--shadow-panel),
    0 0 0 1px var(--gold-700),
    inset 0 0 0 4px transparent,
    inset 0 0 0 5px var(--gold-300);
}

.game-panel--ornate::before,
.game-panel--ornate::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  pointer-events: none;
  border-color: var(--gold-500);
  border-style: solid;
  border-width: 0;
}

.game-panel--ornate::before {
  top: 6px;
  left: 6px;
  border-top-width: 2px;
  border-left-width: 2px;
}

.game-panel--ornate::after {
  bottom: 6px;
  right: 6px;
  border-bottom-width: 2px;
  border-right-width: 2px;
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
  color: var(--gold-500);
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
}

.game-panel--padding-sm .game-panel__body {
  padding: var(--space-2);
}

.game-panel--padding-md .game-panel__body {
  padding: var(--space-3) var(--space-4);
}
</style>
