import type { Reward } from '../reward/Reward'

export type QuestCadence = 'once' | 'daily' | 'weekly'

export type QuestGroupId =
  | 'mainline'
  | 'once'
  | 'day'
  | 'weekly'
  | 'achievement'
  | 'expedition'

export interface CollectQuestCondition {
  kind: 'collect'

  materialId: string

  // So luong phai dang so huu; bi TRU khoi MaterialBag khi claim (turn-in).
  amount: number
}

export interface KillQuestCondition {
  kind: 'kill'

  // Bo trong = bat ky quai nao (trong zoneId neu co).
  enemyId?: string

  // Bo trong = khong gioi han khu vuc.
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

export interface AcquireQuestCondition {
  kind: 'acquire'
  materialId: string
  amount: number
}

export interface RealmQuestCondition {
  kind: 'realm_reached'
  realmId: string
  amount: 1
}

export interface StageQuestCondition {
  kind: 'stage_clear'
  stageId: string
  amount: 1
}

// Event leaves count committed deliveries while active. Acquisition is
// historical progress, never a possession check or a turn-in cost.
export type QuestLeafCondition =
  | CollectQuestCondition | AcquireQuestCondition | KillQuestCondition | FlagQuestCondition
  | RealmQuestCondition | StageQuestCondition

export type QuestObjective = QuestLeafCondition & { id: string }

export interface AllOfQuestCondition {
  kind: 'allOf'
  objectives: readonly QuestObjective[]
}

export type QuestCondition = QuestLeafCondition | AllOfQuestCondition

// Legacy single conditions use a reserved identity only in projections;
// their authoritative counter remains the existing scalar progress field.
export function questObjectives(condition: QuestCondition): readonly QuestObjective[] {
  return condition.kind === 'allOf'
    ? condition.objectives
    : [{ ...condition, id: 'legacy' }]
}

export function isValidQuestCondition(condition: QuestCondition): boolean {
  const leaves = questObjectives(condition)
  const ids = new Set<string>()
  if (!Array.isArray(leaves) || leaves.length === 0) return false
  return leaves.every((leaf) => {
    if (!leaf || typeof leaf.id !== 'string' || leaf.id.trim().length === 0 ||
        ids.has(leaf.id) || !Number.isSafeInteger(leaf.amount) || leaf.amount <= 0) return false
    ids.add(leaf.id)
    switch (leaf.kind) {
      case 'collect':
      case 'acquire': return typeof leaf.materialId === 'string' && leaf.materialId.length > 0
      case 'flag': return typeof leaf.flagId === 'string' && leaf.flagId.length > 0
      case 'realm_reached': return leaf.amount === 1 && typeof leaf.realmId === 'string' && leaf.realmId.length > 0
      case 'stage_clear': return leaf.amount === 1 && typeof leaf.stageId === 'string' && leaf.stageId.length > 0
      case 'kill': return (leaf.enemyId === undefined || typeof leaf.enemyId === 'string') &&
        (leaf.zoneId === undefined || typeof leaf.zoneId === 'string')
      default: return false
    }
  })
}

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

  // Gate theo canh gioi, giong Stage/Building convention.
  requiredRealmId?: string

  // Chain admission gate: unlocked only once this quest id sits in
  // completedOnceIds (the durable chain witness).
  unlocksAfterQuestId?: string

  // UI grouping/marker; 'mainline' renders under the Chinh Tuyen group,
  // and other group ids map directly onto the QuestGroupRail tabs.
  chainId?: 'mainline' | 'day' | 'weekly' | 'achievement' | 'expedition'
}
