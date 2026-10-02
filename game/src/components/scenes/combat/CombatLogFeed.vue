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
.combat-log-feed { position: relative; }
</style>
