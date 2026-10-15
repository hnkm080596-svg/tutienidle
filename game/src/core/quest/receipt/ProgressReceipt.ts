export interface ReceiptEnvelope {
  readonly version: 1
  readonly eventId: string
  readonly playerId: string
  readonly runId: string
  readonly sourceId: string
  readonly committedAtMs: number
  readonly units: number
}

type Owned<P extends string, T> = { readonly producer: P; readonly payload: T }

export type ProgressReceipt = ReceiptEnvelope & (
  | Owned<'inventory', { readonly kind: 'material_delivered'; readonly materialId: string; readonly delivered: number }>
  | Owned<'production', { readonly kind: 'production_batch_claimed'; readonly batchId: string; readonly siteKind: string }>
  | Owned<'battle', { readonly kind: 'enemy_defeated'; readonly battleId: string; readonly enemyId: string; readonly zoneId?: string }>
  | Owned<'battle', { readonly kind: 'battle_victory'; readonly battleId: string; readonly formationAtBattleStart: boolean }>
  | Owned<'battle', { readonly kind: 'stage_clear'; readonly stageId: string; readonly battleId: string; readonly formationAtBattleStart: boolean }>
  | Owned<'realm', { readonly kind: 'realm_reached'; readonly realmId: string }>
  | Owned<'realm', { readonly kind: 'element_attained'; readonly elementId: string }>
  | Owned<'technique', { readonly kind: 'technique_rank_reached'; readonly techniqueId: string; readonly rank: number }>
  | Owned<'skill', { readonly kind: 'skill_node_progress_committed'; readonly nodeId: string; readonly level: number }>
  | Owned<'body', { readonly kind: 'body_refinement_committed'; readonly realmAtCommit: string }>
  | Owned<'cultivation', { readonly kind: 'cultivation_session_committed'; readonly sessionId: string }>
  | Owned<'equipment', { readonly kind: 'equipment_equipped'; readonly instanceId: string }>
  | Owned<'equipment', { readonly kind: 'equipment_enhanced'; readonly instanceId: string; readonly enhancementId: string }>
  | Owned<'alchemy', { readonly kind: 'alchemy_crafted'; readonly craftId: string; readonly recipeId: string }>
  | Owned<'pill', { readonly kind: 'pill_used'; readonly pillId: string }>
  | Owned<'companion', { readonly kind: 'companion_entitled'; readonly companionId: string }>
  | Owned<'formation', { readonly kind: 'formation_companion_assigned'; readonly companionId: string }>
  | Owned<'quest', { readonly kind: 'daily_quest_claimed'; readonly claimId: string; readonly utcDayBucket: number }>
  | Owned<'quest', { readonly kind: 'weekly_quest_claimed'; readonly claimId: string; readonly utcWeekBucket: number }>
  | Owned<'quest', { readonly kind: 'quest_claimed'; readonly questId: string; readonly claimId: string }>
)

export interface ReceiptAllocation {
  consumerId: string
  objectiveId: string
}

export interface ReceiptEntry {
  receipt: ProgressReceipt
  allocations: ReceiptAllocation[]
}

export interface ProgressReceiptLedgerState {
  version: 1
  playerId: string
  runId: string
  enabledAtMs: number
  revision: number
  entries: ReceiptEntry[]
}

export interface ReceiptLedgerIdentity {
  playerId: string
  runId: string
  enabledAtMs: number
}

export type ReceiptRecordResult = 'applied' | 'duplicate' | 'collision' | 'stale' | 'invalid'
