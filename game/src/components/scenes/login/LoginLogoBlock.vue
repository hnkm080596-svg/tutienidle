<script setup lang="ts">
// Scene 01 logo-block region (spec: 1112/168/368/120, card-top, z11).
// Audit class EXCEPTED: baked-text logo art is a separately-approved
// asset; until Minh's brush wordmark lands the title stays app-rendered.
// TEMP ART - .art-needed surfaces map to rows in 01-login.md.
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <header class="login-logo" data-hk-region="logo-block">
    <span class="login-logo__mountains art-needed" data-art-id="login-logo-mountains" aria-hidden="true" />
    <h1 class="login-logo__wordmark art-needed" data-art-id="login-logo-wordmark">
      {{ t('onboarding.auth.wordmark') }}
    </h1>
    <span class="login-logo__seal art-needed" data-art-id="login-logo-seal" aria-hidden="true">仙</span>
  </header>
</template>

<style scoped>
/* Ref: brush wordmark over a dark ink-mountain silhouette with a red
   seal stamp at its right edge. Region 368x120 inside the card top. */
.login-logo {
  position: relative;
  isolation: isolate;
  width: min(100%, 368px);
  height: 120px;
  margin: 0 auto;
  display: grid;
  place-items: center;
}
/* Ink-mountain silhouette plate (temp art). */
.login-logo__mountains {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(180deg, transparent 55%, rgba(16, 23, 24, 0.92)),
    #101718;
  clip-path: polygon(
    0 100%, 0 62%, 7% 40%, 14% 58%, 21% 30%, 28% 52%, 35% 22%,
    43% 48%, 50% 18%, 58% 46%, 66% 26%, 74% 50%, 82% 34%, 90% 56%,
    97% 42%, 100% 60%, 100% 100%
  );
  border-radius: 6px 6px 0 0;
}
.login-logo__wordmark {
  position: relative;
  z-index: 1;
  margin: 0;
  font-family: var(--hk-font-display, 'Playfair Display', 'Noto Serif SC', serif);
  font-size: clamp(30px, 2.6vw, 44px);
  font-weight: 700;
  font-style: italic;
  letter-spacing: 0.04em;
  line-height: 1;
  background: linear-gradient(180deg, #f4d98b 15%, #b99a55 70%, #e8c35a);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.55);
  white-space: nowrap;
}
.login-logo__seal {
  position: absolute;
  z-index: 1;
  right: 6px;
  bottom: 14px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  background: linear-gradient(160deg, #b54432, #7e2e21);
  color: var(--hk-ivory, #ede6d6);
  font: 700 var(--text-md) var(--hk-font-display, serif);
  border-radius: 4px;
  transform: rotate(6deg);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
</style>
