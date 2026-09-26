// contracts/operations.ts -- the discriminated union IS the runtime
// contract. `type` is inseparable from `payload` (review: no
// {type:'heal', payload:damagePayload}).
//
// NO top-level sourceId on ResolvedCombatOperation -- origin.sourceId is
// the single canonical source (review r2 HIGH 3: op.sourceId /
// op.origin.sourceId / payload.sourceId would be three mutable copies).
//
// No path-specific primitives (CON-23): the vocabulary is generic (sec.5).

import type { DamageScalingConfig } from '../../combat/DamageCalculator'
import type { ElementType } from '../../element/ElementType'
import type { SkillDamageComponent } from '../../skill/SkillDamageComponent'

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
  // Instance-local penetration pool (canonical-seals addendum): folded
  // into BuffPeriodicDamageRequest.elementalPenetrationBonus, never
  // mutates source.stats. Points on the Resistance.ts scale (1 = 1%).
  | 'elemental_penetration'

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
        channel from profile+origin, never the executor. 'skill_hit' is the
        skill pipeline's hit-resolving channel (wired to full hit
        resolution -- dodge/crit/armor/components/scaling -- by the
        DamageAuthority in M3/M4). */
    damageProfile: string
    /** Authored coefficient -- NOT final damage. DamageSystem still applies
        stats/scaling/profile/mitigation/crit. */
    coefficient: number
    hitCount: number
    canCrit: boolean
    canMiss: boolean
    periodicId?: string
    tags?: readonly string[]
    /** Multi-component damage lanes (20% phys + 80% fire parity) -- the
        hit-resolving profile splits the coefficient per component.
        `element` carries the single-lane shorthand. Primordial lanes ride
        components{kind:'primordial'} -- `element` keeps its ElementType|
        'physical' union (adapter stat-key indexing stays total). */
    components?: readonly SkillDamageComponent[]
    /** Declared scaling inputs -- DamageAuthority resolves each term
        against `snapshot` (frozen at cast) when present, live stats
        otherwise. */
    scaling?: DamageScalingConfig
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
    /** Instance-local penetration bonus (canonical-seals addendum +
        spec D7): ADDITIVE points on top of the source's elemental
        penetration stat at damage resolution -- never a stats
        mutation. Legal iff element is an ElementType (never
        'physical' / undefined) AND the carrier is EITHER
        (origin.kind === 'buff_periodic' AND damageProfile ===
        'legacy_dot') OR (origin.kind === 'skill' AND damageProfile ===
        'skill_hit' -- the authored elementalPenetration /
        penetrationFromStacks channels fold here); structural
        validation faults any other carrier. */
    elementalPenetrationBonus?: number
    /** Contract v1.6 -- DECLARED hit/crit/armor intent. The producer
        declares, DamageAuthority consumes CombatRng and performs every
        roll; the executor/scheduler never roll these. Semantics mirror
        HitResolveOptions (resolved-outcome options on resolveActionHit):
          hitPolicy.guaranteedHit     -- skip the accuracy/evasion roll
          critPolicy.bonusChance      -- extra crit roll chance on top of
                                        the profile's base channel
          armorPolicy.bypassChance    -- one roll: full armor bypass
          armorPolicy.pierceFractionOnFail -- else mitigation x
                                        (1 - fraction)
        Policies are only legal on hit-resolving profiles (validation:
        critPolicy contradicts canCrit:false; policies on non-hit
        profiles fault). */
    hitPolicy?: { guaranteedHit?: boolean }
    critPolicy?: { bonusChance?: number }
    armorPolicy?: { bypassChance?: number; pierceFractionOnFail?: number }
    /** The Tu missing-HP scalar (ActionDamageInfo parity): the
        authority re-reads the ATTACKER's live missing-HP fraction at
        hit resolution and folds (1 + min(cap, fraction x perPercent
        x 100)) into the multiplier -- never a snapshot value. */
    missingHpBonusPerMissingPercent?: number
    missingHpBonusCap?: number
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
  /** son_nhac_ho_the externalWard grant (The Tu Task 11): orchestration
      metadata, NOT BuffAuthority input -- when this op settles resolved,
      the turn runtime writes `target.externalWard =
      {sourceId, amount: max(0, source.stats.maxHp * sourceMaxHpRatio)}`
      (replace semantics, exempt from wardMax). The pool's lifecycle is
      existence-bound to the applied marker instance via
      reconcileExternalWard at the stat-refresh seam. */
  externalWardGrant?: { sourceMaxHpRatio: number }
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
  payload: {
    targetId: CombatEntityId
    query: BuffCleanseQuery
    /** Contract v1.6 -- deterministic cap on dispellable removals:
        undefined = all matching dispellable instances (legacy behavior);
        N = the first N in canonical sortedForTarget order. `skipped`
        still reports every matched-but-non-dispellable instance.
        Legacy remove_buff-by-polarity parity maps {polarity, count} onto
        {query:{polarity}, limit: count ?? 1}. */
    limit?: number
  }
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
