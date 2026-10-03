<script setup lang="ts">
// Resource cluster (scene 03 spec region `resource-cluster`, center of
// the top bar): docks the CurrencyHud pill strip. The shared HUD keeps
// its own styling; only its absolute self-positioning is neutralized so
// it flows inside the bar.
import CurrencyHud from '@/components/game/CurrencyHud.vue'
</script>

<template>
  <div class="global-top-bar__resources" data-hk-region="resource-cluster">
    <CurrencyHud />
  </div>
</template>

<style scoped>
.global-top-bar__resources {
  justify-self: center;
  display: flex;
  justify-content: center;
}

/* Docked chips - the shared component keeps its own styling; only the
   absolute self-positioning is neutralized so it flows inside the bar. */
.global-top-bar__resources :deep(.currency-hud) {
  position: static;
  max-width: none;
  pointer-events: auto;
}

@media (max-width: 720px) {
  .global-top-bar__resources {
    justify-self: center;
  }
}
</style>
