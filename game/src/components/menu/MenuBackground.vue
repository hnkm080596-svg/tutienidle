<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { currentTheme } = useTheme()

const bgGradient = computed(() => {
  switch (currentTheme.value) {
    case 'ink-minimal':
      return 'linear-gradient(180deg, #fdfbf7 0%, #ebe3d2 100%)'
    case 'landscape-shanshui':
      return 'linear-gradient(180deg, #d8ccb0 0%, #6b5942 50%, #2c1810 100%)'
    case 'xianxia-glow':
      return 'radial-gradient(circle at 50% 30%, #5c3d8f 0%, #0d0a14 70%)'
    case 'classical-imperial':
      return 'linear-gradient(180deg, #f5e6e0 0%, #8b1a1a 70%, #2c0a0a 100%)'
    case 'default':
    default:
      return 'radial-gradient(circle at 50% 30%, rgba(212,165,87,0.08), transparent 60%), linear-gradient(180deg, #0a0a0f 0%, #050507 100%)'
  }
})
</script>

<template>
  <div class="menu-background" aria-hidden="true" :style="{ background: bgGradient }" />
</template>

<style scoped>
.menu-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
</style>
