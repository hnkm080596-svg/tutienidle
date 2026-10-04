<script setup lang="ts">
// Scene 10 turn-strip region (spec: 436/64/800/96, combat family,
// turn-token asset - already delivered via TurnOrderStrip).
// ui-combat reskin (2026-10-04): the temp `.art-needed` rail band is
// gone - TurnOrderStrip now carries its own surface-m-panel framed rail,
// so this wrapper only centers it.
import TurnOrderStrip from '@/components/game/combat/TurnOrderStrip.vue'
</script>

<template>
  <div class="combat-turn-rail" data-hk-region="turn-strip">
    <TurnOrderStrip />
  </div>
</template>

<style scoped>
.combat-turn-rail { position: relative; display: flex; justify-content: center; }
</style>
