<script setup lang="ts">
// Ambient server-status line on the vista corner (outside the scroll).
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <p class="login-ambient-status"><i /> {{ t('onboarding.auth.status') }}</p>
</template>

<style scoped>
.login-ambient-status {
  position: absolute;
  left: 14px;
  bottom: 12px;
  z-index: 1;
  margin: 0;
  color: var(--hk-text-primary, #ede6d6);
  font-size: var(--text-xs);
  opacity: 0.75;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.login-ambient-status i {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--jade);
  box-shadow: 0 0 7px var(--jade);
}
</style>
