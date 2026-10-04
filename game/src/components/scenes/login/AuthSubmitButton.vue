<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import { LOGIN_ART } from './loginArt'
defineProps<{ mode: 'login' | 'register'; canSubmit: boolean; submitting: boolean }>()
const { t } = useI18n()
</script>

<template>
  <GameButton class="auth-primary-action" type="submit" variant="ghost" size="lg"
    :disabled="!canSubmit" :loading="submitting" data-hk-region="primary-action">
    <img class="auth-primary-action__art" :src="LOGIN_ART.button" alt="" aria-hidden="true" draggable="false" />
    <span class="auth-primary-action__text">{{ t(`onboarding.auth.tabs.${mode}`) }}</span>
  </GameButton>
</template>

<style scoped>
.auth-primary-action {
  width: 104%;
  margin: 0 -2%;
  min-height: 12cqw;
  padding: 1.8cqw 6cqw;
  border: 0;
  overflow: visible;
  color: #ffecaf;
  font: 500 4cqw var(--hk-font-display, Georgia, serif);
  text-shadow: 0 1px 3px #071d17;
  transition: filter 160ms, transform 160ms;
}
.auth-primary-action :deep(.game-button__label) { position: static; }
.auth-primary-action__art {
  position: absolute;
  width: 104%;
  height: auto;
  left: -2%;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}
.auth-primary-action__text { position: relative; z-index: 1; display: block; line-height: 1.2; transform: translateY(-.8cqw); }
.auth-primary-action:disabled { opacity: 1; filter: saturate(.8); }
.auth-primary-action:not(:disabled):hover { color: #fff6d3; filter: brightness(1.13); }
.auth-primary-action:focus-visible { outline: 2px solid #715923; outline-offset: 3px; box-shadow: none; }
@media (prefers-reduced-motion: reduce) { .auth-primary-action { transition: none; } }
</style>
