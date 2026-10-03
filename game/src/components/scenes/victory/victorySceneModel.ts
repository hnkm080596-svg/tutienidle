// Scene 14 (spec 15) VICTORY view-model types - the scene reads the
// canonical BattleRewardSummary accumulated by GameManager and maps it
// onto the reference regions: reward slot row (treasure gains) and the
// Tang Truong growth cards (mastery/insight gains).
import type { BattleRewardItemKind } from '@/core/reward/BattleRewardSummary'

export type VictorySlotKind = 'currency' | BattleRewardItemKind

export interface VictorySlotView {
  id: string
  kind: VictorySlotKind
  /** Resolved PNG path when the registry entry carries an icon; null = glyph fallback. */
  icon: string | null
  /** Caption under the tile (canonical material/pill/equipment name or i18n label). */
  name: string
  amount: number
}

export type VictoryGrowthId = 'techniqueMastery' | 'skillInsight' | 'artifactInsight'

export interface VictoryGrowthCardView {
  id: VictoryGrowthId
  /** i18n label key already registered under combat.rewards.* */
  labelKey: `combat.rewards.${VictoryGrowthId}`
  amount: number
  /** Visual accent for the card glyph: jade (insight) / gold (mastery) / cinnabar (artifact). */
  accent: 'jade' | 'gold' | 'cinnabar'
}

export interface VictorySceneView {
  /** Stage display name when resolvable (canonical stage name); null = i18n subtitle. */
  stageName: string | null
  slots: VictorySlotView[]
  growth: VictoryGrowthCardView[]
}
