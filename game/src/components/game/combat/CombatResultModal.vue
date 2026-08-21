<script setup lang="ts">
import { computed } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import CombatVictoryPanel from './CombatVictoryPanel.vue'
import CombatDefeatPanel from './CombatDefeatPanel.vue'

// Combat UI Redesign mục 14/18 — CHỈ hiện cho trận Stage (qua
// StageSelectPanel.vue), KHÔNG hiện cho Tribulation (Đột Phá đã có
// luồng kết quả riêng — WorldAnnouncement + mất tu vi/buff phạt, xem
// useTribulation.ts) — 2 lớp kết quả chồng nhau sẽ rối, xem
// ui.combatOrigin's ghi chú trong stores/ui.ts.
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const ui = useUiStore()

const outcome = computed(() => {
  stateVersion.value

  if (ui.combatOrigin !== 'stage') {
    return null
  }

  const state = gameManager.getBattle()?.state

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
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 5, 8, 0.72);
  pointer-events: auto;
}
</style>
