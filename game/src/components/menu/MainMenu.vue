<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MenuBackground from './MenuBackground.vue'
import MenuLogo from './MenuLogo.vue'
import MenuButton from './MenuButton.vue'

const { t } = useI18n({ useScope: 'local' })

const emit = defineEmits<{
  start: []
  settings: []
}>()

const handleStart = () => emit('start')
const handleContinue = () => emit('start')
const handleSettings = () => emit('settings')
const handleExit = () => {
  try { window.close() } catch {}
}
</script>

<template>
  <div class="main-menu">
    <MenuBackground />
    <div class="main-menu__content">
      <MenuLogo />
      <nav class="main-menu__actions">
        <MenuButton :label="t('menu.main.start')" variant="primary" @click="handleStart" />
        <MenuButton :label="t('menu.main.continue')" variant="secondary" @click="handleContinue" />
        <MenuButton :label="t('menu.main.settings')" variant="secondary" @click="handleSettings" />
        <MenuButton :label="t('menu.main.exit')" variant="secondary" @click="handleExit" />
      </nav>
      <div class="main-menu__version">v1.2.3</div>
    </div>
  </div>
</template>

<style scoped>
.main-menu {
  position: fixed;
  inset: 0;
  z-index: 1000;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #08080c;
}

.main-menu__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

.main-menu__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.main-menu__version {
  position: absolute;
  bottom: 16px;
  right: 16px;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--surface-text-muted);
}
</style>
