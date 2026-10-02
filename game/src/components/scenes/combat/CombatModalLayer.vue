<script setup lang="ts">
// Scene 10 modals region (spec: 436/220/800/500 z30, state-driven):
// intro banner, countdown, pause/exit-confirm and result modals.
import CombatExitConfirmModal from '@/components/game/combat/CombatExitConfirmModal.vue'
import CombatResultModal from '@/components/game/combat/CombatResultModal.vue'
import CombatIntroOverlay from '@/components/game/combat/CombatIntroOverlay.vue'
import CombatCountdownOverlay from '@/components/game/combat/CombatCountdownOverlay.vue'
</script>

<template>
  <div class="combat-modal-layer" data-hk-region="modals">
    <CombatExitConfirmModal />
    <CombatResultModal />
    <CombatIntroOverlay />
    <CombatCountdownOverlay />
  </div>
</template>

<style scoped>
.combat-modal-layer { position: absolute; inset: 0; pointer-events: none; }
</style>
