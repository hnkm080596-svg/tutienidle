<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <header class="login-logo" data-hk-region="logo-block">
    <h1 class="login-logo__title">
      {{ t('onboarding.auth.wordmark') }}
    </h1>
  </header>
</template>

<style scoped>
.login-logo { margin: 0 -3cqw 1cqw; }
.login-logo__title { margin: 0; color: #272317; font: 600 52px/1.25 var(--font-display, Georgia, serif); letter-spacing: -.045em; text-shadow: 0 1px #fff8e5; }
</style>
