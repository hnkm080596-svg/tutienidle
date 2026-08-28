<script setup lang="ts">
// Shared chrome primitive (UI/UX rework Giai đoạn A) — thay button
// hand-roll (mỗi panel tự khai background/color/border riêng) bằng 1
// component dùng chung, tái dùng token --gold/--jade/--crimson/--tap-*
// có sẵn trong theme.css.
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
}>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  type: 'button',
})

defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <button
    :type="type"
    class="game-button"
    :class="[`game-button--${variant}`, `game-button--${size}`, { 'is-loading': loading }]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="game-button__spinner" aria-hidden="true" />
    <span class="game-button__label"><slot /></span>
  </button>
</template>

<style scoped>
.game-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-weight: 700;
  cursor: pointer;
  transition: box-shadow 150ms ease, transform 150ms ease, opacity 150ms ease, border-color 150ms ease, color 150ms ease;
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

.game-button--primary {
  background: linear-gradient(180deg, var(--gold-300), var(--gold-700));
  color: var(--gold-ink);
}

.game-button--primary:not(:disabled):hover {
  box-shadow: var(--shadow-glow-gold);
  transform: translateY(-1px);
}

.game-button--secondary {
  background: var(--ink-800);
  color: var(--text-primary);
  border-color: var(--ink-line);
}

.game-button--secondary:not(:disabled):hover {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.game-button--danger {
  background: var(--crimson);
  color: #fff;
}

.game-button--danger:not(:disabled):hover {
  box-shadow: 0 0 12px -2px var(--crimson);
  transform: translateY(-1px);
}

.game-button--ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--ink-line-soft);
}

.game-button--ghost:not(:disabled):hover {
  color: var(--gold-500);
  border-color: var(--gold-500);
}

.game-button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-gold);
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
