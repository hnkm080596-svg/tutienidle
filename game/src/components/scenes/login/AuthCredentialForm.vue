<script setup lang="ts">
// Scene 01 form region (spec: 1048/352/496/240, form family, gap 16):
// id field + password field + submit-level live error + ceremonial CTA.
// Owns only layout + the submit event; auth behavior stays in the
// screen's composition root.
import LoginIdField from './LoginIdField.vue'
import LoginPasswordField from './LoginPasswordField.vue'
import AuthSubmitButton from './AuthSubmitButton.vue'

const loginId = defineModel<string>('loginId', { required: true })
const password = defineModel<string>('password', { required: true })

defineProps<{
  mode: 'login' | 'register'
  canSubmit: boolean
  submitting: boolean
  error: string
}>()

const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <form class="auth-form" data-hk-region="form" @submit.prevent="emit('submit')">
    <LoginIdField v-model="loginId" />
    <LoginPasswordField v-model="password" />
    <!-- Submit-level error is a live region (screen reader announces it). -->
    <p v-if="error" id="auth-error-submit" class="auth-form__hint is-error" role="alert">{{ error }}</p>
    <AuthSubmitButton :mode="mode" :can-submit="canSubmit" :submitting="submitting" />
  </form>
</template>

<style scoped>
.auth-form {
  display: grid;
  gap: 16px;
  text-align: left;
  /* spec region h 240 design px (240/941) */
  min-height: 25.5vh;
  align-content: start;
}
.auth-form__hint {
  margin: 0;
  font-size: var(--text-xs);
}
.is-error {
  color: var(--cinnabar, #b54432);
}
</style>
