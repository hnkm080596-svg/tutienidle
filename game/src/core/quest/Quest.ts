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

export type QuestCondition = CollectQuestCondition | KillQuestCondition

export interface QuestItemReward {
  kind: 'material' | 'pill'

  itemId: string

  amount?: number
}

export interface QuestReward {
  // Tái dùng RewardSystem hiện có (spiritStone/cultivation/techniqueInsight).
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
}
