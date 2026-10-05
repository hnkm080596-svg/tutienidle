<script setup lang="ts">
import { LOGIN_ART } from './loginArt'
</script>

<template>
  <section class="login-scroll auth-card" data-hk-region="auth-card">
    <img class="login-scroll__art" :src="LOGIN_ART.panel" alt="" aria-hidden="true" draggable="false" />
    <div class="auth-card__content"><slot /></div>
    <footer class="auth-card__footer"><slot name="footer" /></footer>
  </section>
</template>

<style scoped>
.login-scroll {
  position: relative;
  z-index: 1;
  container-type: inline-size;
  width: 579px;
  aspect-ratio: 1074 / 1440;
  margin-right: 58px;
  color: #343125;
  font-family: var(--hk-font-display, Georgia, serif);
  filter: drop-shadow(0 12px 26px #050c13a6);
}
.login-scroll__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
}
.auth-card__content {
  position: absolute;
  inset: 13% 16% 18% 16%;
  display: flex;
  flex-direction: column;
  gap: 1.6cqw;
  padding: 0 1cqw 1cqw;
  /* Logo + primary-action art deliberately bleed past the content box on
     the X axis; without a clip, overflow-y:auto computes overflow-x:auto
     and paints a stray horizontal scrollbar under the guest button. */
  overflow-x: clip;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #94754066 transparent;
  text-align: center;
}
.auth-card__content > :deep(*) { flex-shrink: 0; }
.auth-card__footer { position: absolute; bottom: 11%; left: 16%; right: 16%; }
</style>
