<template>
  <div class="menu-logo" :class="{ 'menu-logo--glow': isGlowTheme }">
    <h1 class="menu-logo__title" :style="{ fontFamily: fontFamily }">
      TIÊN HIỆP IDLE
    </h1>
    <div class="menu-logo__underline" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { currentTheme } = useTheme()

const isGlowTheme = computed(() => currentTheme.value === 'xianxia-glow')

const fontFamily = computed(() => {
  switch (currentTheme.value) {
    case 'landscape-shanshui':
      return "'Ma Shan Zheng', cursive"
    case 'xianxia-glow':
      return "'Noto Serif SC', serif"
    case 'classical-imperial':
      return "'ZCOOL XiaoWei', serif"
    default:
      return 'var(--font-display)'
  }
})
</script>

<style scoped>
.menu-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.menu-logo__title {
  margin: 0;
  font-size: 3rem;
  font-weight: 400;
  letter-spacing: 0.15em;
  color: var(--surface-text);
  line-height: 1.2;
}

.menu-logo__underline {
  width: 100%;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--surface-eyebrow) 20%,
    var(--surface-eyebrow) 80%,
    transparent
  );
}

.menu-logo--glow .menu-logo__title {
  color: var(--surface-glow-gold);
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% {
    text-shadow: 0 0 10px var(--surface-glow-gold), 0 0 20px var(--surface-glow-gold);
  }
  50% {
    text-shadow: 0 0 20px var(--surface-glow-gold), 0 0 40px var(--surface-glow-gold), 0 0 60px var(--surface-glow-gold);
  }
}

/* UI-006 (Task 4) — reduced motion: glow đứng yên (giữ màu, bỏ pulse). */
@media (prefers-reduced-motion: reduce) {
  .menu-logo--glow .menu-logo__title {
    animation: none;
  }
}
</style>
