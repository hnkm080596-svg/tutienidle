import type { Reward } from '../reward/Reward'

export type AchievementBand = 'mortal' | 'qi_refining' | 'foundation_establishment' | 'fixed'

export type AchievementObjective =
  | { kind: 'counter'; counter: AchievementCounter; target: number }
  | { kind: 'facts'; keys: readonly string[] }
  | { kind: 'daily_streak'; target: 7 }
  | { kind: 'weekly_claims'; target: 4; minimumPeriods: 2 }

export type AchievementCounter =
  | 'mortal_wood' | 'wild_boar' | 'production_batches' | 'spirit_ore'
  | 'unique_equipment' | 'body_all' | 'bandit' | 'qi_herb' | 'alchemy_crafts'
  | 'enhancements' | 'spirit_wolf' | 'formed_victories' | 'body_foundation'

export interface AchievementDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly band: AchievementBand
  /** Base reward; only the downstream RewardSystem settlement may scale stones/cultivation. */
  readonly reward: Readonly<Reward>
  readonly objective: AchievementObjective
}

interface WitnessBase {
  playerId: string
  eventId: string
  committed: boolean
  authority: AchievementAuthority
  sourceId: string
  occurredAt: number
}

export type AchievementAuthority = 'inventory' | 'battle' | 'production' | 'equipment' | 'body' | 'alchemy' | 'technique' | 'companion' | 'formation' | 'quest'

/** Producer-owned, successful transaction witness. Never create these from UI or inferred totals. */
export type AchievementReceipt = WitnessBase & (
  | { kind: 'material_delivered'; materialId: string; quantityDelivered: number }
  | { kind: 'enemy_defeated'; enemyId: string }
  | { kind: 'production_batch_claimed'; batchId: string; realmAtCommit: string }
  | { kind: 'equipment_equipped'; instanceId: string }
  | { kind: 'body_refinement_committed'; realmAtCommit: string }
  | { kind: 'alchemy_crafted'; craftId: string }
  | { kind: 'equipment_enhanced'; enhancementId: string }
  | { kind: 'battle_victory'; battleId: string; formationAtBattleStart: boolean }
  | { kind: 'technique_rank_reached'; rank: number }
  | { kind: 'companion_entitled'; companionId: string }
  | { kind: 'formation_companion_assigned'; companionId: string }
  | { kind: 'daily_quest_claimed'; claimId: string; utcDayBucket: number }
  | { kind: 'weekly_quest_claimed'; claimId: string; utcWeekBucket: number }
)

/** Only quest, stage and progression owners can provide these durable facts. */
export interface AchievementOwnerSnapshot {
  playerId: string
  completedStageIds: readonly string[]
  completedOnceIds: readonly string[]
  reachedRealmIds: readonly string[]
  attainedElementIds: readonly string[]
  techniqueRankThreeEver?: boolean
  entitledCompanionIds?: readonly string[]
  assignedCompanionIds?: readonly string[]
}

/** Versioned separate slice; the coordinator must wire this into save shape validation. */
export interface AchievementLedgerState {
  version: 1
  playerId: string
  enabledAt: number
  revision: number
  receiptIds: string[]
  operationIds: string[]
  counters: Partial<Record<AchievementCounter, number>>
  equipmentInstanceIds: string[]
  facts: string[]
  claimedIds: string[]
  dailyClaimDays: number[]
  weeklyClaims: { claimId: string; period: number }[]
  entitledCompanionIds: string[]
  assignedCompanionIds: string[]
}

export interface AchievementReadModel {
  id: string
  title: string
  description: string
  band: AchievementBand
  /** Raw authored reward and immutable intrinsic band for the settlement owner. */
  reward: Readonly<Reward>
  current: number
  target: number
  ready: boolean
  claimed: boolean
  available: boolean
}

export interface AchievementClaimAward {
  claimId: string
  achievementId: string
  playerId: string
  band: AchievementBand
  reward: Readonly<Reward>
}

export type AchievementClaimResult =
  | 'granted' | 'delivery-failed' | 'not-ready' | 'already-claimed' | 'unknown-achievement'
