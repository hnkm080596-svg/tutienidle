<script setup lang="ts">
// Scene 10 ai-panel region (spec: 16/140/228/280, shell-panel family,
// surface-m-panel + list-row). 5 canonical strategies live inside
// CombatAiPanel (audit: ref's 4 -> real 5).
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import CombatAiPanel from '@/components/game/combat/CombatAiPanel.vue'
</script>

<template>
  <div class="combat-ai-rail" data-hk-region="ai-panel">
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
    <CombatAiPanel />
  </div>
</template>

<style scoped>
.combat-ai-rail { position: relative; isolation: isolate; }

/* InkNineSlice 'surface' renders at z-index 1 - contents need 2. */
.combat-ai-rail > :not(.ink-nine-slice) { position: relative; z-index: 2; }
</style>
