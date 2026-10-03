<script setup lang="ts">
// Scene 15/16 rewards region (spec: 526/360/620/110, slot family,
// hasAnyReward visibility). Audit EXACT: partial rewards via RewardList.
import { useI18n } from 'vue-i18n'
import type { BattleRewardSummary } from '@/core/reward/BattleRewardSummary'
import RewardList from '@/components/game/combat/RewardList.vue'

defineProps<{
  summary: BattleRewardSummary
}>()
const { t } = useI18n()
</script>

<template>
  <section class="combat-defeat-panel__reward-block" data-hk-region="rewards">
    <p class="combat-defeat-panel__reward-header">{{ t('combat.defeat.rewardsHeader') }}</p>
    <RewardList :summary="summary" class="combat-defeat-panel__rewards scrollfade" />
  </section>
</template>

<style scoped>
.combat-defeat-panel__reward-block { margin-bottom: 16px; }
.combat-defeat-panel__reward-header {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--hk-gold-muted, #b99a55);
  letter-spacing: .04em;
}
.combat-defeat-panel__rewards { margin-bottom: 4px; }
</style>
