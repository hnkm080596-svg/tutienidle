<script setup lang="ts">
// Slice 7 HUD dedup fix (Defect Task 7, 2026-09-05) — KiemTuCombatHud/
// MortalCombatHud deleted (were pure duplicates of TurnCombatSkillBar.vue's
// skill slots, see CombatSceneOverlay.vue). PhapTuCombatHud kept (has
// ArtifactCombatSlot, unique to that path). kiem_tu/mortal now render
// nothing here — their skill input lives solely in TurnCombatSkillBar.
import { computed } from 'vue'
import PhapTuCombatHud from './PhapTuCombatHud.vue'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'
import { isPhapTuNguHanh } from '@/core/phap-tu/PhapTuPath'

const player = usePlayerStore()
const { stateVersion } = useStateVersion()

const showPhapTuHud = computed(() => {
  stateVersion.value

  // M4 (R6): the element/route/The HUD is ngu_hanh machinery — the WAY
  // is the gate so a collapsed ('phap_tu','ngo_dao') player never sees it.
  return isPhapTuNguHanh(player)
})
</script>

<template>
  <div class="combat-build-hud">
    <PhapTuCombatHud v-if="showPhapTuHud" />
  </div>
</template>

<style scoped>
.combat-build-hud {
  pointer-events: auto;
}
</style>
