<script setup lang="ts">
import { computed } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import CombatVictoryPanel from './CombatVictoryPanel.vue'
import CombatDefeatPanel from './CombatDefeatPanel.vue'

// Combat UI Redesign muc 14/18 - CHI hien cho tran Stage (qua
// StageSelectPanel.vue), KHONG hien cho Tribulation (Dot Pha da co
// luong ket qua rieng - WorldAnnouncement + mat tu vi/buff phat, xem
// useTribulation.ts) - 2 lop ket qua chong nhau se roi, xem
// ui.combatOrigin's ghi chu trong stores/ui.ts.
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const ui = useUiStore()

const outcome = computed(() => {
  stateVersion.value

  if (ui.combatOrigin !== 'stage') {
    return null
  }

  const state = gameManager.getTurnBattle()?.state

  return state === 'victory' || state === 'defeat' ? state : null
})

</script>

<template>
  <div v-if="outcome" class="combat-result-modal">
    <CombatVictoryPanel v-if="outcome === 'victory'" />

    <CombatDefeatPanel v-else />
  </div>
</template>

<style scoped>
.combat-result-modal {
  position: absolute;
  inset: 0;
  /* Tren status bar (z-11) + AI panel/build HUD (z-12) de backdrop phu mo chung. */
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
  pointer-events: auto;
}
</style>
