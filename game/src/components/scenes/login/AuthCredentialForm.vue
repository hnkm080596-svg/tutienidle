<script setup lang="ts">
// Scene 01 form: real fields, a permanently reserved notice slot and CTA.
// Owns only layout + the submit event; auth behavior stays in the
// screen's composition root.
import LoginIdField from './LoginIdField.vue'
import LoginPasswordField from './LoginPasswordField.vue'
import AuthSubmitButton from './AuthSubmitButton.vue'
import LoginNoticeLines from './LoginNoticeLines.vue'
import { isValidLoginId } from '@/services/auth/AuthService'

const loginId = defineModel<string>('loginId', { required: true })
const password = defineModel<string>('password', { required: true })

defineProps<{
  mode: 'login' | 'register'
  canSubmit: boolean
  submitting: boolean
  error: string
  resetNotice: boolean
  credentialError: boolean
}>()

const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <form id="auth-credential-panel" class="auth-form" role="tabpanel" :aria-labelledby="`auth-tab-${mode}`" data-hk-region="form" @submit.prevent="emit('submit')">
    <LoginIdField v-model="loginId" />
    <LoginPasswordField v-model="password" :mode="mode" />
    <LoginNoticeLines :invalid-id="Boolean(loginId && !isValidLoginId(loginId))" :error="error"
      :reset-notice="resetNotice" :credential-error="credentialError" />
    <AuthSubmitButton :mode="mode" :can-submit="canSubmit" :submitting="submitting" />
  </form>
</template>

<style scoped>
.auth-form {
  display: grid;
  gap: 1.5cqw;
  text-align: left;
}
</style>
