<script setup lang="ts">
// Rewards section: plaque header + the 4-column grid of canonical
// SlotView reward cells. Follows the exploration reward convention
// (Minh 2026-10-12): item kinds (material/pill) render the 'item'
// tile with the registry icon, currency lines render the 'preview'
// tile with shared placeholder art; SlotView owns the xN badge and
// the name caption, hover shows the canonical tooltip card (graded
// for materials, plain elsewhere). Rewards arrive beta-admitted on
// the model - render verbatim (contract: never re-filter).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager } from '@/composables/useGameState'
import { formatNumber } from '@/core/format/NumberFormatter'
import { createMaterialTooltipBuilder } from '@/composables/useMaterialTooltip'
import { plainRewardTooltip } from '@/components/scenes/exploration/fidelity/explorationRewards'
import type { TooltipContent, TooltipStatRow } from '@/composables/useTooltip'
import type { SlotVariant } from '@/components/common/SlotTypes'
import QuestSectionPlaque from './QuestSectionPlaque.vue'
import SlotView from '@/components/common/SlotView.vue'
import type { BetaQuestRewardEntry, BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{ row: BetaQuestSurfaceModel }>()

const { t } = useI18n()
const gameManager = useGameManager()
const buildMaterialTooltip = createMaterialTooltipBuilder(t)

// Currency kinds are not inventory items - they render the 'preview'
// tile and pull art from the shared placeholder pool (the same ones
// the exploration reward preview uses until dedicated art lands).
// Tu Vi has no art yet, so its cell falls back to the label monogram.
const CURRENCY_KINDS = new Set<BetaQuestRewardEntry['kind']>(['spiritStone', 'cultivation', 'skillInsight'])
const CURRENCY_ICONS: Partial<Record<BetaQuestRewardEntry['kind'], string>> = {
  spiritStone: '/assets/materials/spirit_stone_ha_pham.png',
  skillInsight: '/assets/currency/skill_insight.png',
}

interface RewardCell {
  key: string
  icon?: string
  label: string
  amount: number
  tooltip?: TooltipContent
  variant: SlotVariant
}

const cells = computed<RewardCell[]>(
  // A malformed row (non-array rewards) renders nothing instead of
  // throwing.
  () => (Array.isArray(props.row.rewards) ? props.row.rewards : []).map((reward, index) => rewardCell(reward, index)),
)

function amountRow(amount: number): TooltipStatRow[] {
  return [{ label: t('panels.stageSelect.rewards.dropAmount'), value: `x${formatNumber(amount)}` }]
}

function rewardCell(reward: BetaQuestRewardEntry, index: number): RewardCell {
  const key = `${reward.kind}-${index}`
  // entry.kind owns the registry choice (exploration convention): an
  // id that somehow also exists in another catalog still renders the
  // declared kind's card.
  if (reward.kind === 'material' && reward.itemId && gameManager.materialRegistry.has(reward.itemId)) {
    const material = gameManager.materialRegistry.get(reward.itemId)
    return {
      key,
      icon: material.icon,
      label: material.name,
      amount: reward.amount,
      tooltip: buildMaterialTooltip(material, { extraRows: amountRow(reward.amount) }),
      variant: 'item',
    }
  }
  if (reward.kind === 'pill' && reward.itemId && gameManager.pillRegistry.has(reward.itemId)) {
    const pill = gameManager.pillRegistry.get(reward.itemId)
    return {
      key,
      icon: pill.icon,
      label: pill.name,
      amount: reward.amount,
      tooltip: plainRewardTooltip(pill.name, pill.description, amountRow(reward.amount)),
      variant: 'item',
    }
  }
  // Currency lines and unresolved item ids land here: no registry hit
  // means no graded card - plain tooltip carrying the "+N" title.
  return {
    key,
    icon: CURRENCY_ICONS[reward.kind],
    label: rewardName(reward),
    amount: reward.amount,
    tooltip: plainRewardTooltip(rewardTitle(reward), undefined, []),
    variant: 'preview',
  }
}

// Cell caption = the short reward name (the xN badge already carries
// the amount); material/pill names come from the domain row.
function rewardName(reward: BetaQuestRewardEntry): string {
  if (reward.name) return reward.name
  if (CURRENCY_KINDS.has(reward.kind)) return t(`panels.quest.rewardShort.${reward.kind}`)
  return t(`panels.quest.rewards.${reward.kind}`, { amount: reward.amount })
}

// Tooltip title keeps the "+N" suffix for currency lines
// ("Linh Thach +500") - the badge's xN stays on the cell.
function rewardTitle(reward: BetaQuestRewardEntry): string {
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
      >
        <SlotView
          :item="cell"
          :icon="cell.icon"
          :label="cell.label"
          :amount="cell.amount"
          :tooltip="cell.tooltip"
          :variant="cell.variant"
          :accessible-label="`${cell.label} x${formatNumber(cell.amount)}`"
          show-label
        />
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
</style>
