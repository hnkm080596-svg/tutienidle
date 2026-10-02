<script setup lang="ts">
// Scene 13 result region (spec: 536/340/600/220 z30, shell-panel,
// surface-m-panel) - victory/defeat banner while isFinished.
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

defineProps<{
  title: string
  text: string
}>()
</script>

<template>
  <div class="tribulation-ui__result" data-hk-region="result">
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
    <div class="tribulation-ui__result-title">{{ title }}</div>
    <div class="tribulation-ui__result-text">{{ text }}</div>
  </div>
</template>

<style scoped>
.tribulation-ui__result { position:absolute; top:40%; left:50%; transform:translate(-50%, -50%); display:flex; flex-direction:column; gap:8px; isolation:isolate; padding:26px 40px; border-radius:var(--radius-md); }
.tribulation-ui__result > :not(.ink-nine-slice) { position:relative; z-index:2; }
.tribulation-ui__result-title { font-family:var(--font-display); font-size:var(--text-display-lg); font-weight:800; text-shadow:0 0 18px var(--scene-tribulation-glow); }
.tribulation-ui__result-text { font-size:var(--text-sm); color:var(--scene-tribulation-text-soft); }
</style>
