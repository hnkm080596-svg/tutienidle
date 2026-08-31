<script setup lang="ts">
import { formatNumber } from '@/core/format/NumberFormatter'
import type { BattleRewardSummary } from '@/core/reward/BattleRewardSummary'

defineProps<{
  summary: BattleRewardSummary
}>()
</script>

<template>
  <ul class="reward-list">
    <li v-if="summary.techniqueInsight > 0" class="reward-list__item">
      Cảm Ngộ Tâm Pháp <span class="reward-list__value">+{{ formatNumber(summary.techniqueInsight) }}</span>
    </li>
    <li v-if="summary.skillInsight > 0" class="reward-list__item">
      Cảm Ngộ Kỹ Năng <span class="reward-list__value">+{{ formatNumber(summary.skillInsight) }}</span>
    </li>
    <li v-if="summary.artifactInsight > 0" class="reward-list__item">
      Kinh Nghiệm Pháp Bảo <span class="reward-list__value">+{{ formatNumber(summary.artifactInsight) }}</span>
    </li>
    <li v-if="summary.spiritStone > 0" class="reward-list__item">
      Linh Thạch <span class="reward-list__value">+{{ formatNumber(summary.spiritStone) }}</span>
    </li>
    <li v-for="item in summary.items" :key="`${item.kind}-${item.itemId}`" class="reward-list__item">
      {{ item.name }} <span class="reward-list__value">+{{ formatNumber(item.amount) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.reward-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: min(240px, 30vh);
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.reward-list__item {
  display: flex;
  justify-content: space-between;
  margin: 0;
  font-size: var(--text-body);
  color: var(--paper-text-soft, #5e5a50);
}

.reward-list__value {
  color: var(--jade);
  font-weight: 700;
}
</style>
