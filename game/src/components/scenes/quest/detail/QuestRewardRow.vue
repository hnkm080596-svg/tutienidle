<script setup lang="ts">
// "Thuong Nhiem Vu" reward row: the ref's line of icon cells with xN
// counts. Rewards arrive beta-admitted on the model - render verbatim
// (contract: never re-filter). Material/pill lines get the
// registry-resolved icon when one exists; currency lines get a label
// chip.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager } from '@/composables/useGameState'
import { formatNumber } from '@/core/format/NumberFormatter'
import QuestSectionPlaque from './QuestSectionPlaque.vue'
import type { BetaQuestRewardEntry, BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{ row: BetaQuestSurfaceModel }>()

const { t } = useI18n()
const gameManager = useGameManager()

interface RewardCell {
  key: string
  icon: string | null
  label: string
  amount: number
}

const cells = computed<RewardCell[]>(
  () => props.row.rewards.map((reward, index) => ({
    key: `${reward.kind}-${index}`,
    icon: rewardIcon(reward),
    label: rewardLabel(reward),
    amount: reward.amount,
  })),
)

function rewardIcon(reward: BetaQuestRewardEntry): string | null {
  if (!reward.itemId) return null
  if (reward.kind === 'material' && gameManager.materialRegistry.has(reward.itemId)) {
    return gameManager.materialRegistry.get(reward.itemId).icon ?? null
  }
  if (reward.kind === 'pill' && gameManager.pillRegistry.has(reward.itemId)) {
    return gameManager.pillRegistry.get(reward.itemId).icon ?? null
  }
  return null
}

function rewardLabel(reward: BetaQuestRewardEntry): string {
  if (reward.name) return reward.name
  return t(`panels.quest.rewards.${reward.kind}`, { amount: reward.amount })
}
</script>

<template>
  <section v-if="cells.length" class="quest-rewards">
    <QuestSectionPlaque :text="t('panels.quest.scene.rewardsTitle')" />
    <ul class="quest-rewards__cells">
      <li
        v-for="cell in cells"
        :key="cell.key"
        class="quest-rewards__cell"
        :title="cell.label"
      >
        <img
          v-if="cell.icon"
          class="quest-rewards__icon"
          :src="cell.icon"
          :alt="cell.label"
        />
        <span v-else class="quest-rewards__token" art-needed data-art-id="reward-icon">{{ cell.label }}</span>
        <span class="quest-rewards__amount">x{{ formatNumber(cell.amount) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.quest-rewards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quest-rewards__cells {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quest-rewards__cell {
  position: relative;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border: 1px solid var(--hk-border-muted, var(--paper-line));
  border-radius: var(--hk-radius-sm, 5px);
  background: color-mix(in srgb, var(--hk-ink, #101718) 30%, transparent);
}

.quest-rewards__icon {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.quest-rewards__token {
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
  padding: 0 3px;
  color: var(--hk-text-secondary, var(--paper-text-soft));
}

.quest-rewards__amount {
  position: absolute;
  right: 2px;
  bottom: 1px;
  font-size: 9px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--hk-gold, #e3bd67);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}
</style>
