<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LOCALE_OPTIONS, saveLocale } from '@/composables/locale'
const { t, locale } = useI18n()
</script>

<template>
  <div class="login-locale" data-hk-region="locale-chips" role="group" :aria-label="t('onboarding.auth.language')">
    <svg class="login-locale__globe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18M5 6.5h14M5 17.5h14" /></svg>
    <button v-for="option in LOCALE_OPTIONS" :key="option" type="button"
      class="login-locale__option" :class="{ active: locale === option }" :aria-pressed="locale === option"
      :data-testid="`auth-locale-${option}`" @click="saveLocale(option)">
      <span class="login-locale__label">{{ t(`panels.settings.language.names.${option}`) }}</span>
    </button>
  </div>
</template>

<style scoped>
.login-locale { display: flex; justify-content: center; align-items: center; gap: 1cqw; margin-top: .5cqw; color: #c9bd9d; }
.login-locale__globe { width: 3.5cqw; height: 3.5cqw; fill: none; stroke: currentColor; stroke-width: 1.3; }
/* Frameless text options on the dark card (Minh 2026-10-07): bright idle,
   gold active, no drawn slice. */
.login-locale__option { position: relative; min-height: 6.5cqw; padding: .5cqw 2.4cqw; border: 0; background: none; color: #d8c89e; font: 2.5cqw var(--hk-font-display, Georgia, serif); cursor: pointer; }
.login-locale__option.active { color: #ffdf8e; font-weight: 700; text-shadow: 0 1px 2px #000; border-bottom: 1px solid #c9a66a; }
.login-locale__option:hover { color: #fff0bd; }
.login-locale__label { position: relative; z-index: 2; }
.login-locale__option:focus-visible { outline: 2px solid #315f55; outline-offset: 1px; }
</style>
