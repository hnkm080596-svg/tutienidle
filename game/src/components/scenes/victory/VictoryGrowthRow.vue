<script setup lang="ts">
// Scene 14 region `growth` (design 526/420/620/140): the "Tang Truong"
// card row - one card per populated growth kind from the canonical
// summary (audit: real kinds only; companion intimacy is
// FUTURE_IMPLEMENTED and never rendered).
import { useI18n } from 'vue-i18n'
import type { VictoryGrowthCardView } from './victorySceneModel'
import VictoryGrowthCard from './VictoryGrowthCard.vue'

defineProps<{ cards: VictoryGrowthCardView[] }>()

const { t } = useI18n()
</script>

<template>
  <ul
    class="victory-growth scrollfade"
    data-hk-region="growth"
  >
    <VictoryGrowthCard v-for="card in cards" :key="card.id" :card="card" />
    <li v-if="!cards.length" class="victory-growth__empty">{{ t('combat.victory.growthEmpty') }}</li>
  </ul>
</template>

<style scoped>
.victory-growth {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 12px;
  margin: 0;
  padding: 6px 4px;
  list-style: none;
  /* Spec growth band 140 design px incl. its section plaque -> the row
     keeps ~116 design px (12.4vh) instead of collapsing to a bar. */
  height: 12.4vh;
  overflow-y: auto;
  scrollbar-width: none;
}
.victory-growth::-webkit-scrollbar { display: none; }
.victory-growth__empty {
  margin: 0;
  list-style: none;
  font-size: var(--text-sm);
  color: var(--hk-text-muted, #7a7260);
}
</style>
