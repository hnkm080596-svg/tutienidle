import type { Reward } from '../reward/Reward'

export type QuestCadence = 'once' | 'daily'

export interface CollectQuestCondition {
  kind: 'collect'

  materialId: string

  // Số lượng phải đang sở hữu; bị TRỪ khỏi MaterialBag khi claim (turn-in).
  amount: number
}

export interface KillQuestCondition {
  kind: 'kill'

  // Bỏ trống = bất kỳ quái nào (trong zoneId nếu có).
  enemyId?: string

  // Bỏ trống = không giới hạn khu vực.
  zoneId?: string

  amount: number
}

export interface FlagQuestCondition {
  kind: 'flag'

  // Feature-witness id (e.g. QUEST_FLAG_ALCHEMY_CRAFTED). Counted via
  // QuestSystem.onFlag landings while the quest is active - same
  // activation-counts rule as kill/collect.
  flagId: string

  amount: number
}

export type QuestCondition = CollectQuestCondition | KillQuestCondition | FlagQuestCondition

// Feature-witness flag ids emitted by domain seams into
// QuestSystem.onFlag. Domain writers emit the literal id; the constants
// keep quest data and emission points from drifting apart.
export const QUEST_FLAG_ALCHEMY_CRAFTED = 'alchemy.crafted'

// Manifest of every emitted flag id (dotted domain.event convention).
// i18nKeyParity (P16) exempts manifest members only - a dotted literal
// not listed here still gets checked as an i18n key.
export const QUEST_FLAG_IDS: readonly string[] = [QUEST_FLAG_ALCHEMY_CRAFTED]

export interface QuestItemReward {
  kind: 'material' | 'pill'

  itemId: string

  amount?: number
}

export interface QuestReward {
  // Tai dung RewardSystem hien co (spiritStone/cultivation/skillInsight).
  reward?: Reward

  itemDrops?: QuestItemReward[]
}

export interface Quest {
  id: string

  name: string

  description: string

  condition: QuestCondition

  reward: QuestReward

  cadence: QuestCadence

  // Gate theo cảnh giới, giống Stage/Building convention.
  requiredRealmId?: string

  // Chain admission gate: unlocked only once this quest id sits in
  // completedOnceIds (the durable chain witness).
  unlocksAfterQuestId?: string

  // UI grouping/marker; 'mainline' renders under the Chinh Tuyen group.
  chainId?: 'mainline'
}
