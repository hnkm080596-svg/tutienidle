<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LOGIN_ART } from './loginArt'

const { t } = useI18n()
</script>

<template>
  <header class="login-logo" data-hk-region="logo-block">
    <h1 class="login-logo__title">
      <img class="login-logo__wordmark" :src="LOGIN_ART.wordmark" :alt="t('onboarding.auth.wordmark')" />
    </h1>
  </header>
</template>

<style scoped>
.login-logo { margin: 0 0 1cqw; }
.login-logo__title { margin: 0; }
.login-logo__wordmark { display: block; width: 100%; height: auto; filter: drop-shadow(0 1px #fff8e5); }
</style>
