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
  // Phap Tu Reimagined (spec D4) -- landed-gate secondary intents:
  // living enemies of the source EXCLUDING the current lane target
  // ('loop_target' at resolve). Legal ONLY inside a deal_damage
  // onLanded lane (validation rejects them elsewhere); 'other_enemy'
  // binds the first member (canonical order), 'other_enemies' the
  // whole set.
  | 'other_enemy'
  | 'other_enemies'

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
  // Phap Tu Reimagined (spec D12) -- inverse of stacks_at_least:
  // summed stacks on `target` strictly below `max`.
  | {
      kind: 'stacks_below'
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
      max: number
    }
  | { kind: 'crit_landed' }
  | { kind: 'any_target_landed' }
  /** The plan's hit-channel ops against THIS target landed (TurnBattleSystem
      per-hit ailment/detonate gate parity). Single-binding intents only
      ('loop_target' inside for_each_target, 'primary_target', 'self',
      'attacker'); compiles to an ops_landed_any read + var branch at
      RESOLVE -- faults when no preceding deal_damage op targeted it. */
  | { kind: 'target_hit_landed'; target?: SkillTargetIntent }

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
      /** Hoa An spec sec.62 (Xich Viem shared/No) -- scale the DIRECT
          hit's coefficient by ailment stacks WITHOUT consuming:
          coefficient += live stacks x damagePerStack per hit target.
          'own' (default) reads the source's own instance; 'any' sums
          every source's instance on the target. */
      scaleBuff?: {
        definitionId: BuffDefinitionId
        damagePerStack: ScalarExpression
        scope?: 'own' | 'any'
      }
      consumeWard?: { damagePerWardPoint: ScalarExpression }
      healPercentOfDamage?: ScalarExpression
      /** Phap Tu Reimagined (spec D7 Kim) -- flat elemental-penetration
          points added to this hit; forwarded onto the DealDamageOperation
          payload's elementalPenetrationBonus (element-kind components
          only; see operations.ts). Folded at RESOLVE when possible. */
      elementalPenetration?: ScalarExpression
      /** Phap Tu Reimagined (spec D11 Kim Liet) -- live-read sibling of
          scaleBuff: penetration points = stacks(definitionId, target,
          scope) x perStack, read BEFORE the hit resolves, never
          consuming (Kim Liet: read-before-hit, add-after-landed). */
      penetrationFromStacks?: {
        definitionId: BuffDefinitionId
        perStack: ScalarExpression
        scope?: 'own' | 'any'
      }
      /** Cuong Chien missing-HP scalar (ActionDamageInfo parity) --
          bonus damage proportional to the attacker's LIVE missing-HP
          fraction, resolved per hit by the damage authority. */
      missingHpBonusPerMissingPercent?: number
      missingHpBonusCap?: number
      /** Per-landed-HIT consequence ops (TBS resolveDeclaredHit parity):
          compiled INSIDE each instance's landed gate, after the consume
          lanes -- ailments/detonate fire once per landed instance hit,
          not once per target. `target` inside binds via 'loop_target'
          to the hit's target.
          Phap Tu Reimagined (spec D4): the lane also allows `if` ops
          (bounded nesting) and ONE secondary `deal_damage` per lane
          whose target must be 'other_enemy'/'other_enemies' (the
          secondary's own onLanded may carry non-deal_damage ops only).
          for_each_target/read_stacks are still rejected inside. */
      onLanded?: readonly AuthoredSkillOperation[]
      /** Phap Tu Reimagined (spec D4/D5 secondary cap) -- legal ONLY on a
          landed-gate secondary hit (a deal_damage inside another op's
          onLanded lane): this hit may execute at most once per cast, on
          the FIRST landed primary instance. On an AoE cast with N
          landing targets the rider still mints only one secondary
          resolution (Thuy/Tho Phap The 'one secondary target per cast').
          Resolved at plan time: ops carrying this flag compile inside a
          branch gated on `ops_landed_any` over every earlier primary
          hit's operation ids. */
      oncePerCast?: boolean
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
      /** son_nhac_ho_the externalWard grant -- orchestration metadata
          carried onto the resolved op (contract v1.6); the turn runtime
          replays the source-tagged ward write at settle. */
      externalWardGrant?: { sourceMaxHpRatio: number }
    }
  | {
      type: 'add_buff_stacks' | 'remove_buff_stacks' | 'consume_buff_stacks'
      /** Buff-targeting mutation ops bind an authored selector -- an
          'identity' selector pins the source's own instance (same-source
          seal access); the TARGET intent may be set-valued (one resolved
          selector per member) while 'identity.source' must bind a single
          entity. */
      selector: AuthoredBuffSelector
      stacks: ScalarExpression | 'all'
    }
  | {
      type: 'add_buff_modifier' | 'remove_buff_modifier'
      selector: AuthoredBuffSelector
      modifier: AuthoredModifier
      /** Hoa An spec sec.11/36 result gate: resolve to an
          `on_apply_result` plan step bound to the preceding apply_buff
          for the same definition+target -- the op runs only when that
          apply returned applied:true and binds its returned
          instanceId, so a resisted reapply can never mutate the stale
          instance. Set by adaptAilmentInteractions when the same def
          applies the interacted seal. */
      gateOnApplyResult?: boolean
    }
  | {
      type: 'refresh_buff_duration' | 'extend_buff_duration'
      selector: AuthoredBuffSelector
      turns?: number
      gateOnApplyResult?: boolean
    }
  | {
      type: 'trigger_buff_periodic'
      selector: AuthoredBuffSelector
      periodicId?: string
      gateOnApplyResult?: boolean
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
  /** detonateDoT parity -- executor-expanded consume->burst->re-seed per
      periodic-carrying ailment instance on the resolved target. Emitted
      inside a target_hit_landed gate for damaging defs (TBS fires it
      per landed hit), ungated for non-damaging ones. */
  | { type: 'detonate'; target: SkillTargetIntent; amp: number }
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
      /** READ op -- binds ONE holder's summed stacks into `into`. `target`
          and `source` are single-binding intents only (a set would have no
          defined variable binding); `source` scopes the sum to instances
          applied by that source (absent = any source). */
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
      into: string
      source?: SkillTargetIntent
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
