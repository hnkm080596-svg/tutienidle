<script setup lang="ts">
// Scene 10 skill-dock region (spec: 1540/80/132/560, combat family,
// skill-orb-frame — delivered inside TurnCombatSkillBar). Beta scope:
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
.combat-action-dock { height: 100%; }
</style>
