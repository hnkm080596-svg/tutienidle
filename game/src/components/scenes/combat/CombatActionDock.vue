<script setup lang="ts">
// Scene 10 skill-dock region (spec: 1540/80/132/560, combat family,
// skill-orb-frame - delivered inside TurnCombatSkillBar). Beta scope:
// Basic + Special orbs only, Ultimate scope-hidden, Q/W badges RESERVED.
import CombatSkillDockPanel from '@/components/game/combat/CombatSkillDockPanel.vue'

defineProps<{ fighting: boolean }>()
</script>

<template>
  <div v-if="fighting" class="combat-action-dock" data-hk-region="skill-dock">
    <CombatSkillDockPanel />
  </div>
</template>

<style scoped>
/* Spec region 10 skill-dock 1540/80/132/560 on the 1672x941 canvas:
   right-edge dock under the top bar, 7.89vw wide, height from content
   capped at 59.5vh. The wrapper itself carries the region geometry and
   MUST stay out of the overlay's column flex flow: as a flex child with
   height:100% it consumed every free pixel, squeezing __battlefield to
   zero height and pushing the ai-panel (top:calc(14.88vh - topbar-h))
   below the viewport during live combat. Absolute placement preserves
   the flex space for the battlefield; the whole region still unmounts
   with `fighting` at victory/defeat. */
.combat-action-dock {
  position: absolute;
  top: 8.5vh;
  right: 0;
  width: 7.89vw;
  min-width: 96px;
  max-height: 59.5vh;
  z-index: 12;
}
</style>
