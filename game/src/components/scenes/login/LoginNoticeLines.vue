<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{
  resetNotice: boolean
  credentialError: boolean
  invalidId: boolean
  error: string
}>()
const { t } = useI18n()
</script>

<template>
  <div class="login-notices" aria-live="polite" aria-atomic="true" data-hk-region="notice">
    <p v-if="invalidId" id="auth-error-id" class="login-notices__line is-error">
      {{ t('onboarding.auth.errors.invalidId') }} {{ t('onboarding.auth.placeholders.loginId') }}
    </p>
    <p v-else-if="error" id="auth-error-submit" class="login-notices__line is-error">{{ error }}</p>
    <p v-else-if="credentialError" class="login-notices__line is-error" data-testid="auth-credential-error">
      {{ t('onboarding.auth.credentialError') }}
    </p>
    <p v-else-if="resetNotice" class="login-notices__line">{{ t('onboarding.auth.saveCleared') }}</p>
  </div>
</template>

<style scoped>
.login-notices {
  box-sizing: border-box;
  height: 7cqw;
  min-height: 30px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #94754066 transparent;
  display: grid;
  align-items: center;
  text-align: left;
}
.login-notices__line { margin: 0; color: #65533d; font-size: max(11px, 2.4cqw); line-height: 1.35; overflow-wrap: anywhere; }
.login-notices__line.is-error { color: #923421; }
</style>
