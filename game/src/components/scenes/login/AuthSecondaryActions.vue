<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import type { ResumeCandidate } from '@/composables/resumeSession'
defineProps<{ resume: ResumeCandidate | null; resumeReady: boolean; submitting: boolean }>()
const emit = defineEmits<{ continue: []; guest: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="auth-secondary" data-hk-region="secondary-actions">
    <div class="auth-secondary__buttons">
      <GameButton v-if="resumeReady && resume" class="auth-secondary__action" variant="secondary" size="md"
        :disabled="submitting" :loading="submitting" data-testid="auth-continue-button"
        :title="resume.name ? t('onboarding.auth.continue', { name: resume.name }) : undefined"
        @click="emit('continue')">
        <svg class="auth-secondary__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 6v6h5" /></svg>
        {{ t('onboarding.auth.continueNoName') }}
      </GameButton>
      <GameButton class="auth-secondary__action" variant="secondary" size="md" :disabled="submitting"
        data-testid="auth-guest-button" data-hk-region="guest-action" @click="emit('guest')">
        <svg class="auth-secondary__icon auth-secondary__icon--lotus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-5 4-5 9 0 14 5-5 5-10 0-14ZM2 9c0 7 4 11 10 11C8 16 6 12 2 9ZM22 9c0 7-4 11-10 11 4-4 6-8 10-11Z" /></svg>
        {{ t('onboarding.auth.guest.button') }}
      </GameButton>
    </div>
  </div>
</template>

<style scoped>
.auth-secondary__buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 2cqw; }
/* wave B chrome: button-standard slice (secondary = untinted sheet)
   owns the shell; only layout + text tone stay here. */
.auth-secondary__action {
  min-height: 8.3cqw;
  width: 100%;
  padding: 1cqw 2cqw;
  color: #d8cba5;
  font: 500 2.9cqw var(--hk-font-display, Georgia, serif);
}
.auth-secondary__action:only-child { grid-column: 1 / -1; }
.auth-secondary__action:not(:disabled):hover { color: #fff0bd; }
.auth-secondary__action :deep(.game-button__label) { display: flex; align-items: center; justify-content: center; gap: 1.5cqw; }
.auth-secondary__icon { width: 4cqw; height: 4cqw; fill: none; stroke: currentColor; stroke-width: 1.8; }
.auth-secondary__icon--lotus { fill: currentColor; stroke-width: .5; }
</style>
