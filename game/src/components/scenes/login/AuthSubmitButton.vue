<script setup lang="ts">
// Scene 01 primary CTA (spec family: button-ceremonial). Submit-type
// inside the credential form; the click path goes through form submit.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'

defineProps<{
  mode: 'login' | 'register'
  canSubmit: boolean
  submitting: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <GameButton
    class="auth-primary-action"
    type="submit"
    variant="primary"
    size="lg"
    :disabled="!canSubmit"
    :loading="submitting"
    data-hk-region="primary-action"
  >
    {{ mode === 'login' ? t('onboarding.auth.submit.login') : t('onboarding.auth.submit.register') }}
  </GameButton>
</template>

<style scoped>
.auth-primary-action {
  width: 100%;
  margin-top: 2px;
}
</style>
