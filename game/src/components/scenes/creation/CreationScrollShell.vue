<script setup lang="ts">
import { LOGIN_ART } from '../login/loginArt'
</script>

<template>
  <section class="creation-scroll" data-hk-region="creation-card">
    <img class="creation-scroll__art" :src="LOGIN_ART.panel" alt="" aria-hidden="true" draggable="false" />
    <div class="creation-scroll__back"><slot name="back" /></div>
    <div class="creation-scroll__body"><slot /></div>
  </section>
</template>

<style scoped>
.creation-scroll { position: absolute; inset: 0; container-type: inline-size; font-family: var(--hk-font-display, Georgia, serif); filter: drop-shadow(0 12px 26px #050c13a6); }
.creation-scroll__art { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.creation-scroll__back { position: absolute; top: 13%; left: 18.5%; z-index: 1; }
.creation-scroll__body { position: absolute; inset: 13% 18.5% 13%; display: flex; flex-direction: column; gap: 6px; }
.creation-scroll__body > :deep(*) { flex-shrink: 0; }
</style>
