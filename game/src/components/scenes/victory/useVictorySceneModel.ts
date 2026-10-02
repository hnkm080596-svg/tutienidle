// Scene 14 VICTORY read-model: maps the canonical BattleRewardSummary
// (GameManager.getBattleRewardSummary() - same object the previous
// panel rendered) into slot tiles + growth cards, and resolves the
// subtitle's stage name through catalogOps. Item icons come from the
// bags the rewards were just granted into (material/pill/equipment
// stacks carry the same icon fields the bag UI renders); a missing
// stack falls back to a neutral glyph, never to invented art.
import { computed } from 'vue'
import type { Ref } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import type { BattleRewardSummary } from '@/core/reward/BattleRewardSummary'
import type {
  VictoryGrowthCardView,
  VictorySceneView,
  VictorySlotView,
} from './victorySceneModel'

const GROWTH_ORDER: { id: VictoryGrowthCardView['id']; accent: VictoryGrowthCardView['accent'] }[] = [
  { id: 'techniqueMastery', accent: 'gold' },
  { id: 'skillInsight', accent: 'jade' },
  { id: 'artifactInsight', accent: 'cinnabar' },
]

export function useVictorySceneModel(summary: Ref<BattleRewardSummary>) {
  const gameManager = useGameManager()
  const ui = useUiStore()
  const { stateVersion } = useStateVersion()

  const stageName = computed(() => {
    const stageId = ui.selectedStageId
    if (!stageId) return null
    return gameManager.catalogOps.getStage(stageId)?.name ?? null
  })

  const slots = computed<VictorySlotView[]>(() => {
    stateVersion.value

    const out: VictorySlotView[] = []

    if (summary.value.spiritStone > 0) {
      const stone = gameManager.materialBag.get(SPIRIT_STONE_MATERIAL_ID)?.material
      out.push({
        id: 'spirit_stone',
        kind: 'currency',
        icon: stone?.icon ? resolveAssetUrl(stone.icon) : null,
        name: stone?.name ?? 'Linh Thạch',
        amount: summary.value.spiritStone,
      })
    }

    for (const item of summary.value.items) {
      let icon: string | null = null
      if (item.kind === 'material') {
        icon = gameManager.materialBag.get(item.itemId)?.material.icon ?? null
      } else if (item.kind === 'pill') {
        icon = gameManager.pillBag.get(item.itemId)?.pill.icon ?? null
      } else if (item.kind === 'equipment') {
        // Summary carries the template id; the dropped instance (already
        // in the bag) holds the resolved icon.
        icon = gameManager.equipmentBag.getAll().find(i => i.itemId === item.itemId)?.icon ?? null
      }
      out.push({
        id: `${item.kind}-${item.itemId}`,
        kind: item.kind,
        icon: icon ? resolveAssetUrl(icon) : null,
        name: item.name,
        amount: item.amount,
      })
    }

    return out
  })

  const growth = computed<VictoryGrowthCardView[]>(() => {
    return GROWTH_ORDER
      .filter(({ id }) => summary.value[id] > 0)
      .map(({ id, accent }) => ({
        id,
        labelKey: `combat.rewards.${id}`,
        accent,
        amount: summary.value[id],
      }))
  })

  const view = computed<VictorySceneView>(() => ({
    stageName: stageName.value,
    slots: slots.value,
    growth: growth.value,
  }))

  return { view, stageName, slots, growth }
}
