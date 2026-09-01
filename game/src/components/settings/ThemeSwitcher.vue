<!-- game/src/components/settings/ThemeSwitcher.vue -->
<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { currentTheme, themes, setTheme } = useTheme()
</script>

<template>
  <div class="theme-switcher" data-testid="theme-switcher">
    <div
      v-for="theme in themes"
      :key="theme.id"
      class="theme-card"
      :class="{ 'theme-card--selected': theme.id === currentTheme }"
      :data-testid="'theme-card'"
      :data-theme-id="theme.id"
      :data-selected="theme.id === currentTheme ? 'true' : 'false'"
      role="button"
      tabindex="0"
      :aria-label="theme.label"
      @click="setTheme(theme.id)"
      @keydown.enter="setTheme(theme.id)"
    >
      <img :src="theme.preview" :alt="theme.label" class="theme-card__preview" />
      <span class="theme-card__label">{{ theme.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.theme-switcher {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--surface-line-soft);
  border-radius: 8px;
  background: var(--surface-800);
  cursor: pointer;
  transition: transform 200ms ease, border-color 200ms ease;
}

.theme-card:hover {
  border-color: var(--chrome-300);
  transform: translateY(-2px);
}

.theme-card--selected {
  border-color: var(--surface-eyebrow);
  box-shadow: 0 0 0 2px var(--surface-eyebrow);
}

.theme-card__preview {
  width: 100%;
  max-width: 240px;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;
}

.theme-card__label {
  font-family: var(--font-body);
  font-size: var(--text-body);
  color: var(--surface-text);
}
</style>
