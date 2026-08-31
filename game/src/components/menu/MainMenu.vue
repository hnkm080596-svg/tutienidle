<script setup lang="ts">
import { useRouter } from 'vue-router'
import MenuBackground from './MenuBackground.vue'
import MenuLogo from './MenuLogo.vue'
import MenuButton from './MenuButton.vue'

const router = useRouter()

const handleStart = () => router.push({ name: 'game' })
const handleContinue = () => router.push({ name: 'game' })
const handleSettings = () => router.push({ name: 'settings' })
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
        <MenuButton label="Bắt đầu tu luyện" variant="primary" @click="handleStart" />
        <MenuButton label="Tiếp tục" variant="secondary" @click="handleContinue" />
        <MenuButton label="Cài đặt" variant="secondary" @click="handleSettings" />
        <MenuButton label="Thoát" variant="secondary" @click="handleExit" />
      </nav>
      <div class="main-menu__version">v1.2.3</div>
    </div>
  </div>
</template>

<style scoped>
.main-menu {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
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
