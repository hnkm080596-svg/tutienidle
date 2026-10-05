<script setup lang="ts">
// Scene 13 result region (spec: 536/340/600/220 z30, shell-panel,
// surface-m-panel) - victory/defeat banner while isFinished.
import PcPaperChrome from '@/components/common/PcPaperChrome.vue'

defineProps<{
  title: string
  text: string
}>()
</script>

<template>
  <div class="tribulation-ui__result" data-hk-region="result">
    <PcPaperChrome />
    <div class="tribulation-ui__result-title">{{ title }}</div>
    <div class="tribulation-ui__result-text">{{ text }}</div>
  </div>
</template>

<style scoped>
/* Spec 14 result 536/340/600/220: centered band - the 600x220 box
   centers at ~47.8% top. */
.tribulation-ui__result { position:absolute; top:47.82%; left:50%; transform:translate(-50%, -50%); width:min(35.89vw, 600px); display:flex; flex-direction:column; gap:8px; isolation:isolate; padding:26px 40px; border-radius:var(--radius-md); }
.tribulation-ui__result > :not(.ink-nine-slice) { position:relative; z-index:2; }
.tribulation-ui__result-title { font-family:var(--font-display); font-size:var(--text-display-lg); font-weight:800; text-shadow:0 0 18px var(--scene-tribulation-glow); }
.tribulation-ui__result-text { font-size:var(--text-sm); color:var(--scene-tribulation-text-soft); }
</style>
