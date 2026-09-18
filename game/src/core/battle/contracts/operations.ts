// contracts/operations.ts -- the discriminated union IS the runtime
// contract. `type` is inseparable from `payload` (review: no
// {type:'heal', payload:damagePayload}).
//
// NO top-level sourceId on ResolvedCombatOperation -- origin.sourceId is
// the single canonical source (review r2 HIGH 3: op.sourceId /
// op.origin.sourceId / payload.sourceId would be three mutable copies).
//
// No path-specific primitives (CON-23): the vocabulary is generic (sec.5).

import type { ElementType } from '../../element/ElementType'

import type { BuffDefinitionId, CombatEntityId, CombatOperationId } from './ids'
import type { CombatOperationOrigin } from './origin'
import type { BuffInstanceSelector } from './selectors'

// ---------------------------------------------------------------------------
// Reaction eligibility (contract sec.14) -- runtime metadata on an application,
// NOT part of BuffDefinition. Same buff may be applied by skill / reaction /
// proc / script with different eligibility.
// ---------------------------------------------------------------------------

export type ReactionEligibility = 'eligible' | 'suppressed'

// ---------------------------------------------------------------------------
// Buff request-side contract types (spec sec.15 + buff spec sec.29-33).
// ---------------------------------------------------------------------------

/** Authority port input (spec sec.15). Application reason is derived from
    `origin.kind` -- it must not be independently authored with a
    contradictory value. */
export interface ApplyBuffRequest {
  definitionId: BuffDefinitionId
  sourceId: CombatEntityId
  targetId: CombatEntityId
  stacks: number
  baseChance: number
  durationOverride?: number
  reactionEligibility: ReactionEligibility
  origin: CombatOperationOrigin
}

/** BuffModifier channel vocabulary (buff spec sec.30). No path-specific
    channels. */
export type BuffModifierChannel =
  | 'potency'
  | 'periodic_damage'
  | 'next_periodic_damage'
  | 'duration'
  | 'application_chance'

export type BuffModifierLifetime =
  | { type: 'buff_lifetime' }
  | { type: 'uses'; remaining: number }
  | { type: 'holder_turns'; remaining: number }
  | { type: 'source_turns'; remaining: number }
  | { type: 'rounds'; remaining: number }
  | { type: 'battle' }
  | { type: 'explicit' }

/** The buff-spec BuffModifier shape as a contract alias (buff spec sec.29). */
export interface BuffModifierPayload {
  id: string
  appliedBy?: CombatEntityId
  channel: BuffModifierChannel
  operation: 'add' | 'multiply' | 'set'
  value: number
  reapply: 'replace' | 'stack' | 'max' | 'min'
  priority: number
  lifetime: BuffModifierLifetime
}

export type BuffRemovalReason =
  | 'expired'
  | 'consumed'
  | 'cleansed'
  | 'reaction'
  | 'death'
  | 'source_death'
  | 'battle_end'
  | 'replaced'
  | 'scripted'

// ---------------------------------------------------------------------------
// Operation union (contract sec.5). Each member is self-contained: `type`
// discriminates, `payload` is typed per member.
// ---------------------------------------------------------------------------

export type CombatOperation =
  | DealDamageOperation
  | HealOperation
  | ApplyBuffOperation
  | AddBuffStacksOperation
  | RemoveBuffStacksOperation
  | ConsumeBuffStacksOperation
  | AddBuffModifierOperation
  | RemoveBuffModifierOperation
  | RefreshBuffDurationOperation
  | ExtendBuffDurationOperation
  | TriggerBuffPeriodicOperation
  | RemoveBuffOperation
  | SetBuffStacksOperation
  | SetBuffDurationOperation
  | CleanseBuffOperation
  | PushGaugeOperation
  | GainResourceOperation
  | ConsumeResourceOperation
  | ApplyShieldOperation

export interface DealDamageOperation {
  type: 'deal_damage'
  payload: {
    targetId: CombatEntityId
    element?: ElementType | 'physical'
    /** Intent-level profile -- DamageSystem resolves formula/mitigation/crit
        channel from profile+origin, never the executor. */
    damageProfile: string
    /** Authored coefficient -- NOT final damage. DamageSystem still applies
        stats/scaling/profile/mitigation/crit. */
    coefficient: number
    hitCount: number
    canCrit: boolean
    canMiss: boolean
    periodicId?: string
    tags?: readonly string[]
    /** Buff-periodic forward-carriers (Lens B5): stackCount rides for
        profiles that scale on stacks; snapshot carries the apply-time
        source context for snapshot-scaled periodics -- DamageSystem
        resolves against THIS instead of live source stats when present. */
    stackCount?: number
    snapshot?: Readonly<Record<string, number>>
    /** Stat-resolution source override (detonate_burst): the profile
        resolves power/mitigation vs THIS entity while origin.sourceId
        keeps vitals/event attribution. Absent = origin.sourceId. */
    statSourceId?: CombatEntityId
  }
}

export interface HealOperation {
  type: 'heal'
  payload: { targetId: CombatEntityId; amount: number } // always concrete (R-C7)
  // review r4 HIGH 3: no capFractionOfHealTargetMaxHp -- the only consumer
  // (Xuyen Tho) caps the heal RATIO at resolution time, not maxHp at execute
  // time (spec: heal = 5% x D of damage dealt, cap 25% = the ratio's own cap).
}

// Review r2 HIGH 3 -- payload omits sourceId/origin: BOTH come from the op's
// origin envelope (single canonical source). The executor composes the full
// ApplyBuffRequest at dispatch: { ...payload, sourceId: op.origin.sourceId,
// origin: op.origin }. ApplyBuffRequest (the authority port input) keeps its
// sec.15 shape unchanged.
export type ApplyBuffRequestPayload = Omit<ApplyBuffRequest, 'sourceId' | 'origin'>

export interface ApplyBuffOperation {
  type: 'apply_buff'
  payload: ApplyBuffRequestPayload
}

export interface AddBuffStacksOperation {
  type: 'add_buff_stacks'
  payload: { selector: BuffInstanceSelector; stacks: number }
}

export interface RemoveBuffStacksOperation {
  type: 'remove_buff_stacks'
  payload: { selector: BuffInstanceSelector; stacks: number }
}

export interface ConsumeBuffStacksOperation {
  type: 'consume_buff_stacks'
  payload: {
    selector: BuffInstanceSelector
    stacks: number | 'all'
    removalReason: 'consumed' | 'reaction'
  }
}

export interface AddBuffModifierOperation {
  type: 'add_buff_modifier'
  payload: { selector: BuffInstanceSelector; modifier: BuffModifierPayload }
}

export interface RemoveBuffModifierOperation {
  type: 'remove_buff_modifier'
  payload: { selector: BuffInstanceSelector; modifierId: string }
}

export interface RefreshBuffDurationOperation {
  type: 'refresh_buff_duration'
  payload: { selector: BuffInstanceSelector; duration?: number }
}

export interface ExtendBuffDurationOperation {
  type: 'extend_buff_duration'
  payload: { selector: BuffInstanceSelector; turns: number; maxRemaining?: number }
}

export interface TriggerBuffPeriodicOperation {
  type: 'trigger_buff_periodic'
  payload: { selector: BuffInstanceSelector; periodicId?: string }
}

export interface RemoveBuffOperation {
  type: 'remove_buff'
  payload: { selector: BuffInstanceSelector; removalReason: BuffRemovalReason }
}

// v7.1 (buff-plan review amendment) -- spec sec.36/38/42/67 parity: every
// BuffAuthority mutator is reachable via an op (contract sec.8 external
// mutation rule). Producers arrive with their consumers.
export interface SetBuffStacksOperation {
  type: 'set_buff_stacks'
  payload: { selector: BuffInstanceSelector; stacks: number }
}

export interface SetBuffDurationOperation {
  type: 'set_buff_duration'
  payload: { selector: BuffInstanceSelector; duration: number }
}

export interface BuffCleanseQuery {
  kind?: 'buff' | 'debuff' | 'ailment' | 'marker'
  /** Effective-polarity filter (StatModifier.sourceType derivation):
      'debuff' covers kind debuff AND ailment -- the legacy
      "cleanse all debuffs" parity lane (survive-lethal, cleanse
      skills). `kind` stays the literal-kind filter. */
  polarity?: 'buff' | 'debuff'
  tags?: readonly string[]
  element?: ElementType
  definitionId?: BuffDefinitionId
}

export interface CleanseBuffOperation {
  type: 'cleanse_buff'
  payload: { targetId: CombatEntityId; query: BuffCleanseQuery }
}

export interface PushGaugeOperation {
  type: 'push_gauge'
  payload: { targetId: CombatEntityId; fractionOfMax: number }
}

export interface GainResourceOperation {
  type: 'gain_resource'
  payload: { targetId: CombatEntityId; resourceId: string; amount: number }
}

/** 'current' (default) resolves the spend at execution; 'cast_snapshot'
    asserts the numeric amount was frozen at cast time (e.g. an empowered
    ultimate snapshots theBurned at cast -- later gains must not inflate
    the spend). The pair 'all' + 'cast_snapshot' is contradictory ('all'
    is inherently resolve-at-execution) and faults at the authority. */
export type ConsumeResourceValueSource = 'current' | 'cast_snapshot'

export interface ConsumeResourceOperation {
  type: 'consume_resource'
  payload: {
    targetId: CombatEntityId
    resourceId: string
    amount: number | 'all'
    valueSource?: ConsumeResourceValueSource
  }
}

export interface ApplyShieldOperation {
  type: 'apply_shield'
  payload: { targetId: CombatEntityId; amount: number }
}

// ---------------------------------------------------------------------------
// Resolved operation -- the intersection means `type:'heal'` can NEVER carry
// a damage payload.
// ---------------------------------------------------------------------------

export type ResolvedCombatOperation = CombatOperation & {
  operationId: CombatOperationId
  origin: CombatOperationOrigin
}
