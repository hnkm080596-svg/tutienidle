<script setup lang="ts">
// Scene 13 result region (spec: 536/340/600/220 z30) - victory/defeat
// banner while isFinished, rendered with 9-slice GameCard chrome.
import GameCard from '@/components/common/GameCard.vue'

defineProps<{
  title: string
  text: string
}>()
</script>

<template>
  <GameCard as="div" class="tribulation-ui__result" data-hk-region="result">
    <div class="tribulation-ui__result-title">{{ title }}</div>
    <div class="tribulation-ui__result-text">{{ text }}</div>
  </GameCard>
</template>

<style scoped>
/* Spec 14 result 536/340/600/220: centered band - the 600x220 box
   centers at ~47.8% top. */
.tribulation-ui__result {
  position: absolute;
  top: 47.82%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(35.89vw, 600px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  isolation: isolate;
  padding: 26px 40px;
}

.tribulation-ui__result-title {
  font-family: var(--font-display);
  font-size: var(--text-display-lg);
  font-weight: 800;
  color: #f3e7bd;
  text-shadow: 0 0 18px var(--scene-tribulation-glow);
}

.tribulation-ui__result-text {
  font-size: var(--text-sm);
  color: #e9dcc4;
}
</style>
