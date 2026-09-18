// skilldef/AuthoredOperation.ts -- the authored operation vocabulary
// (contract sec.3: intent only, zero runtime ids). Pure type module --
// no runtime code lives here; evaluation belongs to ScalarExpression.ts
// (scalars/conditions) and SkillResolver/SkillExecutor (ops).
//
// Two-layer model (megaplan v2.1):
//   AuthoredSkillOperation (this file, SkillTargetIntent selectors)
//     -> SkillResolver -> ResolvedSkillPlanStep (concrete CombatEntityIds)
// The deep-scan runtime-id guard in SkillDefinitionRegistry enforces the
// authored layer never carries targetId/sourceId/instanceId.

import type { BuffDefinitionId } from '../battle/contracts/ids'
import type {
  BuffModifierPayload,
  BuffRemovalReason,
  ReactionEligibility,
} from '../battle/contracts/operations'
import type { DamageScalingConfig } from '../combat/DamageCalculator'
import type { ElementType } from '../element/ElementType'
import type { SkillDamageComponent } from '../skill/SkillDamageComponent'

import type { ScalarExpression } from './ScalarExpression'

// ---------------------------------------------------------------------------
// Target intents -- authored selectors, NEVER runtime entity ids.
// 'enemy'/'ally' do NOT exist: use 'primary_target'/'affected_targets'/etc.
// 'attacker' binds in reactive contexts only; 'loop_target' binds to the
// enclosing for_each_target's current member and is valid ONLY inside
// for_each_target ops/conditions (validation rejects it elsewhere).
// ---------------------------------------------------------------------------

export type SkillTargetIntent =
  | 'self'
  | 'primary_target'
  | 'affected_targets'
  | 'all_enemies'
  | 'allies_except_self'
  | 'all_allies'
  | 'attacker'
  | 'loop_target'

// ---------------------------------------------------------------------------
// Conditions -- pure/read-only (spec sec.36: no mutation in conditions).
// Authored form carries SkillTargetIntent; the resolver produces
// ResolvedSkillCondition with concrete targetIds (M2). Logical and/or/not
// compose through nested `if` ops rather than dedicated combinators.
// ---------------------------------------------------------------------------

export type SkillCondition =
  | {
      kind: 'stacks_at_least'
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
      stacks: number
    }
  | {
      kind: 'hp_percent_below'
      target: SkillTargetIntent
      threshold: ScalarExpression
    }
  | {
      kind: 'resource_at_least'
      resourceId: string
      amount: number
    }
  // default 'primary_target' ('loop_target' inside for_each_target)
  | { kind: 'target_alive'; target?: SkillTargetIntent }
  | { kind: 'var'; name: string; op: 'gte' | 'lt' | 'eq'; value: number }
  | { kind: 'crit_landed' }
  | { kind: 'any_target_landed' }

// ---------------------------------------------------------------------------
// Buff selectors -- authored form of BuffInstanceSelector (selectors.ts).
// 'instance' cannot exist at authored level (runtime id); 'identity' and
// 'target_definition' carry intents instead of concrete ids.
// ---------------------------------------------------------------------------

export type AuthoredBuffSelector =
  | {
      kind: 'target_definition'
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
    }
  | {
      kind: 'identity'
      definitionId: BuffDefinitionId
      source: SkillTargetIntent
      target: SkillTargetIntent
    }

/** Authored buff modifier -- BuffModifierPayload minus the runtime
    `appliedBy` attribution (the executor stamps origin.sourceId). */
export type AuthoredModifier = Omit<BuffModifierPayload, 'appliedBy'>

/** Authored scaling -- DamageScalingConfig is already pure authored data
    (attribute + mana ratios); alias keeps the authored namespace explicit. */
export type AuthoredScaling = DamageScalingConfig

/** R-S2 landed semantics -- 'default' counts a cast landed when at least
    one op resolves against a live target (self-scope always lands);
    'any_damage_landed' requires a landed damage op; 'always' always
    counts. */
export type LandedSemantics = 'default' | 'any_damage_landed' | 'always'

// ---------------------------------------------------------------------------
// Authored cleanse query -- mirrors BuffCleanseQuery VERBATIM
// (kind/polarity/tags/element/definitionId; polarity:'debuff' covers
// debuff+ailment -- the legacy polarity parity lane). `limit` rides the
// contract-v1.6 CleanseBuffOperation payload (undefined = all, N = first N
// cleansed in canonical sortedForTarget order).
// ---------------------------------------------------------------------------

export interface AuthoredCleanseQuery {
  kind?: 'buff' | 'debuff' | 'ailment' | 'marker'
  polarity?: 'buff' | 'debuff'
  tags?: readonly string[]
  element?: ElementType
  definitionId?: BuffDefinitionId
}

// ---------------------------------------------------------------------------
// AuthoredSkillOperation -- the shared op vocabulary for active casts AND
// passive `operations` bindings (R-S7). Numeric per-op computed fields take
// ScalarExpression (spec sec.33-35: per-target live reads); definition-
// level knobs stay concrete numbers.
// ---------------------------------------------------------------------------

export type AuthoredSkillOperation =
  | {
      type: 'deal_damage'
      target: SkillTargetIntent
      coefficient?: ScalarExpression
      components?: readonly SkillDamageComponent[]
      damageType?: 'physical' | 'primordial'
      hitCount?: number
      canCrit?: boolean
      canMiss?: boolean
      scaling?: AuthoredScaling
      /** Contract v1.6 DECLARED intent -- the executor stamps these onto
          the DealDamageOperation payload; DamageAuthority consumes
          CombatRng and performs the hit/crit/armor rolls. Policies are
          only legal when the op resolves a primary hit (coefficient
          present); critPolicy + canCrit:false is contradictory;
          armorPolicy on an explicitly all-non-physical op is rejected. */
      hitPolicy?: { guaranteedHit?: boolean }
      critPolicy?: { bonusChance?: number }
      armorPolicy?: { bypassChance?: number; pierceFractionOnFail?: number }
      consumeBuff?: {
        definitionId: BuffDefinitionId
        damagePerStack: ScalarExpression
        scope?: 'own' | 'any'
        healPercentOfDamage?: number
      }
      consumeWard?: { damagePerWardPoint: ScalarExpression }
      healPercentOfDamage?: ScalarExpression
    }
  | {
      type: 'heal'
      target: SkillTargetIntent
      amount?: ScalarExpression
      fractionOfMaxHp?: number
      fractionOfPriorDamage?: { fraction: number; capRatio?: number }
    }
  | {
      type: 'apply_buff'
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
      stacks?: ScalarExpression
      chance?: ScalarExpression
      durationOverride?: ScalarExpression
      /** DEFAULT 'suppressed' for non-elemental lanes; the adapter writes
          'eligible' for appliesAilment(s) unconditionally (r4 -- path
          metadata, never the legacy canInitiateWuxingReactions flag). */
      reactionEligibility?: ReactionEligibility
    }
  | {
      type: 'add_buff_stacks' | 'remove_buff_stacks' | 'consume_buff_stacks'
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
      stacks: ScalarExpression | 'all'
    }
  | {
      type: 'add_buff_modifier' | 'remove_buff_modifier'
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
      modifier: AuthoredModifier
    }
  | {
      type: 'refresh_buff_duration' | 'extend_buff_duration'
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
      turns?: number
    }
  | {
      type: 'trigger_buff_periodic'
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
      periodicId?: string
    }
  | {
      type: 'remove_buff'
      target: SkillTargetIntent
      selector: AuthoredBuffSelector
      reason?: BuffRemovalReason
    }
  | {
      type: 'cleanse'
      target: SkillTargetIntent
      query: AuthoredCleanseQuery
      limit?: number
    }
  | { type: 'push_gauge'; target: SkillTargetIntent; fractionOfMax: ScalarExpression }
  | {
      type: 'gain_resource' | 'consume_resource'
      target: SkillTargetIntent
      resourceId: string
      amount: ScalarExpression | 'all'
    }
  | { type: 'apply_shield'; target: SkillTargetIntent; amount: ScalarExpression }
  | {
      type: 'read_stacks'
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
      into: string
    }
  | {
      type: 'if'
      condition: SkillCondition
      then: readonly AuthoredSkillOperation[]
      else?: readonly AuthoredSkillOperation[]
    }
  | {
      type: 'for_each_target'
      target: SkillTargetIntent
      ops: readonly AuthoredSkillOperation[]
    }
