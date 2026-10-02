<script setup lang="ts">
// Spec SS11 top bar (scene 03, canonical layer L8): thin screen-space
// chrome - identity left / global resources center / utilities right.
// World-first: the bar is a translucent edge gradient, never an opaque
// band, and it never moves with the world camera (it lives outside
// .home-scene). Regions decompose into DongFuIdentityPlate /
// DongFuResourceCluster / DongFuUtilitySeals.
import { useI18n } from 'vue-i18n'
import DongFuIdentityPlate from './DongFuIdentityPlate.vue'
import DongFuResourceCluster from './DongFuResourceCluster.vue'
import DongFuUtilitySeals from './DongFuUtilitySeals.vue'

const { t } = useI18n()
</script>

<template>
  <header
    class="global-top-bar"
    role="banner"
    :aria-label="t('home.topBar.aria')"
    data-canonical-layer="L8"
    data-hk-region="top-bar"
  >
    <DongFuIdentityPlate />
    <DongFuResourceCluster />
    <DongFuUtilitySeals />
  </header>
</template>

<style scoped>
.global-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--hk-space-4, 12px);
  /* Spec top-bar band height 74 design px -> 7.86% of the 941 design
     height (7.86vh of the runtime stage). */
  height: 7.86vh;
  box-sizing: border-box;
  padding: 0 var(--hk-space-4, 12px);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 88%, transparent) 0%,
    transparent 100%
  );
  pointer-events: none;
}

.global-top-bar > * {
  pointer-events: auto;
}

@media (max-width: 720px) {
  .global-top-bar {
    grid-template-columns: auto 1fr auto;
  }
}
</style>
