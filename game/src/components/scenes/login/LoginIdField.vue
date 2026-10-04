<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { isValidLoginId } from '@/services/auth/AuthService'
const loginId = defineModel<string>({ required: true })
const { t } = useI18n()
const validId = computed(() => isValidLoginId(loginId.value))
</script>

<template>
  <div class="auth-field-row">
    <label class="sr-only" for="auth-input-id">{{ t('onboarding.auth.labels.loginId') }}</label>
    <div class="auth-field">
      <InkNineSlice chrome-id="text-field" layer="surface" />
      <svg class="auth-field__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4" fill="currentColor" /><path d="M4 21v-3a8 8 0 0 1 16 0v3Z" fill="currentColor" /></svg>
      <input id="auth-input-id" v-model.trim="loginId" autocomplete="username" maxlength="20"
        :placeholder="t('onboarding.auth.labels.loginId')"
        :title="t('onboarding.auth.placeholders.loginId')"
        :aria-invalid="loginId && !validId ? true : undefined"
        :aria-describedby="loginId && !validId ? 'auth-error-id' : undefined" />
    </div>
  </div>
</template>

<style scoped src="./loginFields.css"></style>
