<script setup lang="ts">
// Scene 10 combat-top-bar region (spec: 0/0/1672/56, hud family).
// Owns the zone·stage title, progress/survival banner and exit affordance
// (all inside CombatTopBar) — CORRECTED per audit: no battle-speed
// control, auto toggle lives on the skill dock.
import CombatTopBar from '@/components/game/combat/CombatTopBar.vue'
</script>

<template>
  <div class="combat-top-rail" data-hk-region="combat-top-bar">
    <CombatTopBar />
  </div>
</template>

<style scoped>
.combat-top-rail { height: 100%; }
</style>
