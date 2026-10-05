<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
const password = defineModel<string>({ required: true })
defineProps<{ mode: 'login' | 'register' }>()
const { t } = useI18n()
const visible = shallowRef(false)
</script>

<template>
  <div class="auth-field-row">
    <label class="sr-only" for="auth-input-password">{{ t('onboarding.auth.labels.password') }}</label>
    <div class="auth-field">
      <svg class="auth-field__icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="12" rx="1" fill="currentColor" /><path d="M8 10V6a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="2" /><path d="M12 15v3" stroke="#ece1c9" stroke-width="2" /></svg>
      <input id="auth-input-password" v-model="password"
        :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
        :type="visible ? 'text' : 'password'" class="auth-field__password"
        :placeholder="t('onboarding.auth.labels.password')" :title="t('onboarding.auth.placeholders.password')" />
      <button class="auth-field__reveal" type="button" :aria-pressed="visible"
        :aria-label="t('onboarding.auth.showPassword')" @click="visible = !visible">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /><path v-if="visible" d="m4 3 16 18" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped src="./loginFields.css"></style>
