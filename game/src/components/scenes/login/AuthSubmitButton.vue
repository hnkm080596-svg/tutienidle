<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
defineProps<{ mode: 'login' | 'register'; canSubmit: boolean; submitting: boolean }>()
const { t } = useI18n()
</script>

<template>
  <GameButton class="auth-primary-action pc-paper-button pc-paper-button--secondary" type="submit" variant="ghost" size="lg"
    :disabled="!canSubmit" :loading="submitting" data-hk-region="primary-action">
    <span class="auth-primary-action__text">{{ t(`onboarding.auth.tabs.${mode}`) }}</span>
  </GameButton>
</template>

<style scoped>
.auth-primary-action {
  width: 100%;
  margin: 8px 0;
  min-height: 58px;
  padding: 14px 28px;
  overflow: visible;
  color: #f5e6c6;
  font: 600 22px var(--font-display, Georgia, serif);
  text-shadow: none;
  transition: filter 160ms, transform 160ms;
}
.auth-primary-action :deep(.game-button__label) { position: static; }
.auth-primary-action__text { position: relative; z-index: 1; display: block; line-height: 1.2; }
.auth-primary-action:disabled { opacity: .6; }
.auth-primary-action:not(:disabled):hover { color: #fff4d6; filter: brightness(1.08); }
.auth-primary-action:focus-visible { outline: 2px solid #715923; outline-offset: 3px; box-shadow: none; }
@media (prefers-reduced-motion: reduce) { .auth-primary-action { transition: none; } }
</style>
