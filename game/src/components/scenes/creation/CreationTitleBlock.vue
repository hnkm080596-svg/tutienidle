<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <header class="creation-title-block" data-hk-region="creation-title">
    <p class="creation-title-block__kicker">{{ t('onboarding.creation.headerKicker') }}</p>
    <h1 class="creation-title-block__title">{{ t('onboarding.creation.headerTitle') }}</h1>
    <span class="creation-title-block__rule" aria-hidden="true" />
  </header>
</template>

<style scoped>
.creation-title-block { text-align: center; }
.creation-title-block__kicker { margin: 0 0 3px; color: #81704e; font-size: 11px; letter-spacing: .32em; }
.creation-title-block__title { margin: 0; color: #242e28; font: 600 32px/1.1 var(--hk-font-display, Georgia, serif); letter-spacing: -.025em; text-shadow: 0 1px #fff8de; }
.creation-title-block__rule { display: block; width: 68%; height: 1px; margin: 9px auto 0; background: linear-gradient(90deg, transparent, #9d7f41, transparent); }
</style>
