// Authored intent only. These are not QuestCondition/runtime hook contracts.
// Producer and cutover acceptance must precede any registry adapter.
export type QuestV2Realm = 'mortal' | 'qi_refining' | 'foundation_establishment'
export type QuestV2Number =
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '18'
  | '19'
  | '20'
  | '21'
export type QuestV2Id = `tvdm2_main_${QuestV2Number}`
export type QuestV2EnemyId = 'mortal_wild_boar' | 'bandit' | 'foundation_spirit_wolf'
export type QuestV2MaterialId =
  | 'material_spirit_wood_decade'
  | 'material_spirit_ore_decade'
  | 'tu_linh_thao_qi_refining_decade'
export type QuestV2StageId = 'mortal_dong_10' | 'qi_refining_abyssal_pool' | 'foundation_floor_10'

type NewEvent = { readonly evidence: 'distinct_committed_receipt_after_activation' }
type Milestone = { readonly evidence: 'durable_attainment_reconciled_by_lifecycle' }
type CurrentState = { readonly evidence: 'owner_state_revalidated_at_claim' }

export type QuestV2ObjectiveIntent =
  | (NewEvent & {
      readonly kind: 'kill'
      readonly enemyId: QuestV2EnemyId
      readonly amount: number
    })
  | (NewEvent & {
      readonly kind: 'acquire'
      readonly materialId: QuestV2MaterialId
      readonly amount: number
      readonly source: 'any'
      readonly quantity: 'delivered'
      readonly consumeAtClaim: false
    })
  | (NewEvent & {
      readonly kind: 'production_batch_claimed'
      readonly siteKind: 'ore' | 'herb'
      readonly amount: number
    })
  | (Milestone & {
      readonly kind: 'realm_level_reached'
      readonly realmId: QuestV2Realm
      readonly level: number
    })
  | (Milestone & { readonly kind: 'realm_reached'; readonly realmId: QuestV2Realm })
  | (Milestone & { readonly kind: 'path_element_attained'; readonly element: 'fire' })
  | (Milestone & {
      readonly kind: 'stage_clear'
      readonly stageId: QuestV2StageId
      readonly amount: 1
      readonly outcome: 'whole_stage_victory'
    })
  | (NewEvent & {
      readonly kind: 'equipment_equipped'
      readonly amount: 1
      readonly uniqueMutation: true
      readonly reconcileExistingEquippedCount: 1
    })
  | (NewEvent & {
      readonly kind: 'body_refinement_committed'
      readonly amount: number
      readonly minRealm?: QuestV2Realm
    })
  | (NewEvent & { readonly kind: 'flag'; readonly flagId: 'alchemy.crafted'; readonly amount: 1 })
  | {
      readonly kind: 'technique_rank_at_least'
      readonly rank: 1
      readonly evidence: 'producer_decision_required_current_grade_or_durable_milestone'
    }
  | (NewEvent & {
      readonly kind: 'skill_node_progress_committed'
      readonly element: 'fire'
      readonly amount: 1
      readonly reconcileExistingProgress: 'producer_decision_required'
    })
  | (NewEvent & {
      readonly kind: 'equipment_enhanced'
      readonly amount: 1
      readonly minRealm?: QuestV2Realm
    })
  | (NewEvent & {
      readonly kind: 'pill_used'
      readonly amount: 1
      readonly outcome: 'consumption_and_benefit_committed'
    })
  | (CurrentState & { readonly kind: 'companion_available'; readonly accountOwned: true })
  | (NewEvent & {
      readonly kind: 'formation_member_assigned'
      readonly amount: 1
      readonly reconcileExistingAssignment: true
    })
  | (CurrentState & { readonly kind: 'formation_member_present'; readonly minCount: 1 })
  | {
      readonly kind: 'formation_member_present'
      readonly minCount: 1
      readonly evidence: 'producer_decision_required_claim_state_or_stage_win_snapshot'
    }
  | (NewEvent & {
      readonly kind: 'battle_victory_with_formation'
      readonly amount: 2
      readonly formationEvidence: 'valid_companion_snapshot_at_battle_start'
    })

export type QuestV2Objective = QuestV2ObjectiveIntent & {
  readonly objectiveId: `${QuestV2Id}:o${1 | 2 | 3}`
}
export type QuestV2ReleaseGate =
  | 'objective_engine_and_durable_producers'
  | 'v1_v2_cutover_no_duplicate_rewards'
  | 'realm_admission_preserves_old_quests'
  | 'equipment_faucet_and_cost'
  | 'body_faucet_and_cost'
  | 'production_faucet'
  | 'alchemy_recipe_and_pill_delivery'
  | 'technique_grade_rank_semantics'
  | 'fire_starter_node_eligibility_and_reconcile'
  | 'usable_pill_faucet'
  | 'companion_entitlement_every_beta_account'
  | 'formation_state_and_battle_snapshot'
  | 'q21_formation_evidence_and_migration'
  | 'economy_playthrough'

export interface QuestV2Definition {
  readonly schema: 'quest-v2-authored-intent-1'
  readonly id: QuestV2Id
  readonly designId: `V2-${QuestV2Number}`
  readonly name: string
  readonly description: string
  readonly story: { readonly opening: string; readonly ending: string }
  readonly ctaSuggestions: readonly string[]
  readonly cadence: 'once'
  readonly chainId: 'mainline'
  readonly unlocksAfterQuestId?: QuestV2Id
  readonly admission: { readonly minRealmAttained: QuestV2Realm; readonly predecessor: 'claimed' }
  readonly rewardBand: QuestV2Realm
  // Base values, not pre-scaled. Runtime reward authority owns band scaling.
  readonly reward: {
    readonly spiritStone: number
    readonly cultivation: number
    readonly skillInsight: number
    readonly itemDrops: readonly {
      readonly kind: 'pill'
      readonly itemId: 'tu_linh_dan_qi_refining'
      readonly amount: 1
    }[]
  }
  readonly condition: {
    readonly kind: 'allOf'
    readonly objectives:
      | readonly [QuestV2Objective, QuestV2Objective]
      | readonly [QuestV2Objective, QuestV2Objective, QuestV2Objective]
  }
  readonly release: {
    readonly status: 'blocked_until_producer_and_cutover_acceptance'
    readonly gates: readonly QuestV2ReleaseGate[]
  }
}
