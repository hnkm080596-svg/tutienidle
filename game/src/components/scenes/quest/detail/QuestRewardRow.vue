<script setup lang="ts">
// Rewards section (Codex landscape port): plaque header + the
// preview's 4-column grid of EquipmentArtSlot cells with the xN
// amount overlaid bottom-right. Rewards arrive beta-admitted on the
// model - render verbatim (contract: never re-filter). Material/pill
// lines get the registry-resolved icon when one exists; icon-less
// lines render their label on the frame.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager } from '@/composables/useGameState'
import { formatNumber } from '@/core/format/NumberFormatter'
import QuestSectionPlaque from './QuestSectionPlaque.vue'
import EquipmentArtSlot from '@/components/common/art/EquipmentArtSlot.vue'
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
  // A malformed row (non-array rewards) renders nothing instead of
  // throwing.
  () => (Array.isArray(props.row.rewards) ? props.row.rewards : []).map((reward, index) => ({
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
        <EquipmentArtSlot
          class="quest-rewards__slot"
          :icon="cell.icon ?? undefined"
          :label="cell.label"
          :empty="!cell.icon"
        />
        <span v-if="!cell.icon" class="quest-rewards__token">{{ cell.label }}</span>
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
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.quest-rewards__cell {
  position: relative;
  aspect-ratio: 1;
}

.quest-rewards__slot { pointer-events: none; }

.quest-rewards__token {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
  padding: 0 4px;
  color: #efdfb9;
  pointer-events: none;
}

.quest-rewards__amount {
  position: absolute;
  right: 2px;
  bottom: 1px;
  font-size: 9px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #ffd985;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  pointer-events: none;
}
</style>
