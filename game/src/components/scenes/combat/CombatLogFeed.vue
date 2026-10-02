<script setup lang="ts">
// Scene 10 battle-log region (spec: 1330/620/326/280, shell-panel
// family, surface-m-panel, scrollfade overflow). The feed stays
// BattleLogPanel (self-guarded outside fighting + collapsible).
import BattleLogPanel from '@/components/game/combat/BattleLogPanel.vue'
</script>

<template>
  <div class="combat-log-feed" data-hk-region="battle-log">
    <BattleLogPanel />
  </div>
</template>

<style scoped>
/* Spec 10 battle-log 1330/620/326/280 on the 1672x941 canvas: right
   0.96vw, bottom 4.36vh, 19.5vw wide, capped at 29.76vh tall. */
.combat-log-feed {
  position: absolute;
  right: 0.96vw;
  bottom: 4.36vh;
  width: 19.5vw;
  max-height: 29.76vh;
  z-index: 12;
}
</style>
