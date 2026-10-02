<script setup lang="ts">
// Scene 01 notice lines — conditional copy strips above the form:
// save-cleared notice (post-reset continuity) and the durable guest
// credential recovery error (B1.8 — surfaced, never silently bypassed).
import { useI18n } from 'vue-i18n'

defineProps<{
  resetNotice: boolean
  credentialError: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="resetNotice || credentialError" class="login-notices">
    <p v-if="resetNotice" class="login-notices__line">{{ t('onboarding.auth.saveCleared') }}</p>
    <p
      v-if="credentialError"
      class="login-notices__line is-error"
      role="alert"
      data-testid="auth-credential-error"
    >
      {{ t('onboarding.auth.credentialError') }}
    </p>
  </div>
</template>

<style scoped>
.login-notices {
  display: grid;
  gap: 8px;
}
.login-notices__line {
  margin: 0;
  padding: 6px 10px;
  border: 1px solid var(--paper-line, rgba(42, 41, 36, 0.42));
  border-radius: var(--radius-sm, 2px);
  color: var(--paper-text-soft, #5e5a50);
  font-size: var(--text-xs);
}
.login-notices__line.is-error {
  border-color: var(--cinnabar, #b54432);
  color: var(--cinnabar, #b54432);
}
</style>
