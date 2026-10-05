<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import LoginLogoBlock from './LoginLogoBlock.vue'
defineProps<{ resumeAvailable: boolean; ready: boolean; busy: boolean; error: string }>()
const emit = defineEmits<{ authenticate: [mode: 'login' | 'register']; play: []; settings: [] }>()
const { t } = useI18n()
</script>

<template>
  <section class="login-opening" data-testid="login-opening">
    <LoginLogoBlock />
    <nav class="login-opening__actions" :aria-label="t('onboarding.auth.eyebrow')">
      <PcPaperButton variant="secondary" data-testid="opening-login-button" :disabled="busy" @click="emit('authenticate', 'login')">{{ t('onboarding.auth.tabs.login') }}</PcPaperButton>
      <PcPaperButton variant="secondary" data-testid="opening-register-button" :disabled="busy" @click="emit('authenticate', 'register')">{{ t('onboarding.auth.createAccount') }}</PcPaperButton>
      <PcPaperButton variant="secondary" :data-testid="resumeAvailable ? 'auth-continue-button' : 'auth-guest-button'" :disabled="busy || !ready" :aria-busy="busy" @click="emit('play')">{{ resumeAvailable ? t('onboarding.auth.continueNoName') : t('onboarding.auth.guest.button') }}</PcPaperButton>
      <PcPaperButton variant="secondary" data-testid="opening-settings-button" :disabled="busy" @click="emit('settings')">{{ t('paperNav.settings') }}</PcPaperButton>
      <p v-if="error" class="login-opening__error" role="alert">{{ error }}</p>
    </nav>
  </section>
</template>

<style scoped>
.login-opening { position: absolute; inset: 0; display: grid; align-content: start; justify-items: start; padding: 92px 130px; }
.login-opening :deep(.login-logo) { width: 560px; }
.login-opening__actions { position: absolute; left: 566px; top: 295px; width: 310px; display: grid; gap: 17px; }
.login-opening__actions .pc-paper-button { width: 100%; min-height: 68px; color: #f5e6c6; font: 600 27px var(--font-display, Georgia, serif); box-shadow: 0 4px 12px #65522c40; }
.login-opening__actions .pc-paper-button:focus-visible { outline: 3px solid #836126; outline-offset: 5px; }
.login-opening__actions .pc-paper-button:disabled { opacity: .6; cursor: wait; }
.login-opening__error { color: #983a23; background: #f5ead6e6; padding: 10px; margin: 0; font-size: 17px; }
</style>
