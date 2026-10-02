<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatNumber } from '@/core/format/NumberFormatter'
import type { BattleRewardSummary } from '@/core/reward/BattleRewardSummary'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

defineProps<{
  summary: BattleRewardSummary
}>()

const { t } = useI18n()
</script>

<template>
  <!-- Scene 15/16: reward slot row - each gain renders inside a
       frame-s-slot chip instead of a plain text line. -->
  <ul class="reward-list">
    <li v-if="summary.techniqueMastery > 0" class="reward-list__item">
      <InkNineSlice chrome-id="frame-s-slot" layer="surface" />
      {{ t('combat.rewards.techniqueMastery') }} <span class="reward-list__value">+{{ formatNumber(summary.techniqueMastery) }}</span>
    </li>
    <li v-if="summary.skillInsight > 0" class="reward-list__item">
      <InkNineSlice chrome-id="frame-s-slot" layer="surface" />
      {{ t('combat.rewards.skillInsight') }} <span class="reward-list__value">+{{ formatNumber(summary.skillInsight) }}</span>
    </li>
    <li v-if="summary.artifactInsight > 0" class="reward-list__item">
      <InkNineSlice chrome-id="frame-s-slot" layer="surface" />
      {{ t('combat.rewards.artifactInsight') }} <span class="reward-list__value">+{{ formatNumber(summary.artifactInsight) }}</span>
    </li>
    <li v-if="summary.spiritStone > 0" class="reward-list__item">
      <InkNineSlice chrome-id="frame-s-slot" layer="surface" />
      {{ t('combat.rewards.spiritStone') }} <span class="reward-list__value">+{{ formatNumber(summary.spiritStone) }}</span>
    </li>
    <li v-for="item in summary.items" :key="`${item.kind}-${item.itemId}`" class="reward-list__item">
      <InkNineSlice chrome-id="frame-s-slot" layer="surface" />
      {{ item.name }} <span class="reward-list__value">+{{ formatNumber(item.amount) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.reward-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  max-height: min(200px, 28vh);
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
}

.reward-list__item {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 8px 14px;
  font-size: var(--text-body);
  /* frame-s-slot is a dark charcoal slot - labels ride the on-dark
     ramp, not the pale-paper ramp (was unreadable gray-on-charcoal). */
  color: var(--surface-text, #f3ead8);
}

.reward-list__item .ink-nine-slice { z-index: 0; }
.reward-list__item > :not(.ink-nine-slice) { position: relative; z-index: 1; }

.reward-list__value {
  color: var(--jade);
  font-weight: 700;
}
</style>
