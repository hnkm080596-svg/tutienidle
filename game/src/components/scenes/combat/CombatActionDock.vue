<script setup lang="ts">
// Scene 10 skill-dock region (spec: 1540/80/132/560, combat family,
// skill-orb-frame - delivered inside TurnCombatSkillBar). Beta scope:
// Basic + Special orbs only, Ultimate scope-hidden, Q/W badges RESERVED.
import CombatSkillDockPanel from '@/components/game/combat/CombatSkillDockPanel.vue'

defineProps<{ fighting: boolean }>()
</script>

<template>
  <div v-if="fighting" class="combat-action-dock">
    <CombatSkillDockPanel />
  </div>
</template>

<style scoped>
/* display:contents removes the wrapper from the overlay's column flex
   flow - a real height:100% box starved .combat-scene-overlay__battlefield
   to 0 height and pushed the ai-panel off-viewport. The dock panel inside
   is position:absolute against the overlay root, so it keeps its spec
   anchor (and carries data-hk-region itself) without the wrapper
   producing a flex box. */
.combat-action-dock { display: contents; }
</style>
