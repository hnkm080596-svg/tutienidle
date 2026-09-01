<script setup lang="ts">
interface Props {
  label: string
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  disabled: false,
})

defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <button
    class="menu-button"
    :class="[
      `menu-button--${variant}`,
      { 'menu-button--disabled': disabled },
    ]"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <span class="menu-button__label">{{ label }}</span>
  </button>
</template>

<style scoped>
.menu-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 200px;
  min-height: 48px;
  padding: 12px 32px;
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: 600;
  letter-spacing: 0.05em;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform 200ms ease, box-shadow 200ms ease, background 200ms ease;
  background: transparent;
  color: var(--surface-text);
  border: 1px solid var(--surface-line);
}

.menu-button:hover:not(.menu-button--disabled) {
  transform: translateY(-1px);
}

.menu-button--primary {
  background: linear-gradient(180deg, var(--surface-600), var(--surface-700));
  border-color: var(--surface-eyebrow);
  color: var(--surface-text);
}

.menu-button--primary:hover:not(.menu-button--disabled) {
  box-shadow: var(--surface-glow-gold);
}

.menu-button--secondary {
  background: transparent;
  border-color: var(--surface-line);
}

.menu-button--secondary:hover:not(.menu-button--disabled) {
  background: var(--surface-700);
  border-color: var(--chrome-300);
}

.menu-button--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>