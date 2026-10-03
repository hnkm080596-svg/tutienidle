<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LOGIN_ART } from './loginArt'
const { t } = useI18n()
</script>

<template>
  <header class="login-logo" data-hk-region="logo-block">
    <h1 class="login-logo__title">
      <img :src="LOGIN_ART.wordmark" :alt="t('onboarding.auth.wordmark')" draggable="false" />
    </h1>
  </header>
</template>

<style scoped>
.login-logo { margin: 0 -3cqw 1cqw; }
.login-logo__title { margin: 0; line-height: 0; }
.login-logo__title img { width: 100%; height: auto; user-select: none; }
</style>
