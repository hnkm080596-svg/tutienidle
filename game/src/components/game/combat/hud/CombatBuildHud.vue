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

const player = usePlayerStore()
const { stateVersion } = useStateVersion()

const showPhapTuHud = computed(() => {
  stateVersion.value

  return player.cultivationPath === 'phap_tu'
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
