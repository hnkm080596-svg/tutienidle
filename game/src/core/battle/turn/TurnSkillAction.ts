// Turn-Based Combat Slice 2 (spec 2026-09-04) - skill selection, resource
// gating, and AOE target collection for TurnBattleSystem.resolveNextStep().
// Kept in its own file (separate from TurnBattleSystem.ts) matching the
// existing ActionGauge.ts/TurnQueue.ts one-concern-per-file pattern.
import type { CombatEntity } from '../../combat/CombatEntity'
import type { SkillResourceType } from '../../skill/SkillTypes'
import type { SkillAilmentInteraction } from '../../skill/SkillEffect'
import type { ActionDamageInfo, HitResolveOptions } from '../ActionImpactSystem'
import type { ActionTargeting, CombatVfxPresetId } from '../CombatAction'
import type { TurnBattle, TurnBattleParticipant } from './TurnBattleSystem'
import { areaFor } from '../ActionTargetingSystem'
import { entityGridPosition, type GridPosition } from '../BattleGrid'
import { isCellInShape, type AoeShapeSpec } from './AoeShape'
import { isActionAllowed } from './ActionValidator'

/**
 * Slice 2 skill shape - deliberately NOT the live `Skill` interface
 * (Skill.ts carries 30+ fields for progression/UI/passive concerns this
 * slice doesn't touch). Field names/types mirror the live fields this
 * slice DOES reuse (SkillResourceType, ActionDamageInfo, ActionTargeting)
 * so future content-mapping from real Skill objects is a straight field
 * copy, not a redesign - see design spec sec.3.
 */
export interface TurnSkillAilmentApplication {
  buffDefinitionId: string
  chance: number
  stacks?: number
}

/**
 * The Tu Reimagined (plan Task 11 contract) - one buff application
 * authored on a TurnSkillDefinition.
 */
export interface TurnSkillBuffApplication {
  definitionId: string
  /**
   * 'target' is the legacy alias for 'action_targets' (Kiem Tu combo /
   * Phap Tu empowered payloads) - both resolve to declared.affected.
   */
  target: 'self' | 'target' | 'action_targets' | 'allies_except_self' | 'all_enemies'
  /** Legacy alias of durationOverride (Kiem Tu/Phap Tu payloads). */
  duration?: number
  durationOverride?: number
  /** Kiem Tu combo capstones - apply() repeated N times (default 1). */
  stacks?: number
  /**
   * Mission C Task 10a - ports SkillEffect.stacksPerAffectedTarget
   * (Hau Tho Thanh Luy): the buff lands with stacks = the number of
   * action targets still ALIVE when the buff applies. Supersedes the
   * authored "0 target -> no buff" clause: a whiffed-into-corpse edge
   * still grants the base stack, consistent with `stacks ?? 1`.
   */
  stacksPerAffectedTarget?: boolean
  externalWardGrant?: { sourceMaxHpRatio: number }
}

export interface TurnSkillDefinition {
  id: string
  cooldownTurns: number
  /**
   * R3 (AR-03) - Explicit target scope. Defaults to 'enemy'.
   * 'self' targets the caster without dealing damage.
   */
  targetScope?: 'enemy' | 'self'
  resourceType?: SkillResourceType
  resourceCost?: number
  damage?: ActionDamageInfo
  targeting: ActionTargeting
  /**
   * R3 (AR-18) - Generic composite action policy. Replaces hardcoded
   * content ID checks in the turn engine.
   *
   * 'element_basic' - Phap Tu An (Task 11): the orchestrator attaches the
   * resolved pool ON the def; the engine picks `count` distinct defs
   * uniformly via the injected rng and resolves picks[0] as THE payload
   * (damage/ailments/targeting - the pick executes as the cast). Any
   * extra picks (count > 1) apply damage+ailments through the shared
   * composite-picks lane. The picked def never owns cast identity -
   * rootSkillId keeps cast count/cooldown (INV-18).
   */
  compositePicks?: {
        poolType: 'element_basic'
        count: number
        pool: readonly TurnSkillDefinition[]
      }
  /**
   * Phap Tu An (Task 11) - extra executions of this action, queued as
   * follow-up executions at cast completion (source 'repeat'). Each
   * repeat re-resolves the payload (re-rolls compositePicks). Repeat
   * executions never re-commit cooldown/cast count and never roll
   * multicast (P15).
   */
  repeatCasts?: number
  /**
   * Phap Tu An (Task 11) - multicast passive (ngo_dao_hon_don), attached
   * to the An basic def by the orchestrator. After an original/composite
   * or multicast-sourced execution of this skill completes, roll
   * `chance` via the injected rng - success queues one more execution
   * (source 'multicast'), which re-rolls its own pick and may roll again.
   * Total extra executions per cast are bounded by
   * min(maxExtraCasts, MAX_MULTICAST).
   */
  multicast?: {
    chance: number
    maxExtraCasts: number
  }
  /**
   * The Tu Reimagined (plan Task 6/11) - multi-buff application contract
   * (replaces the singular appliesBuff). Each entry resolves its target
   * set at impact:
   * - 'self' -> the actor
   * - 'action_targets' -> declared.affected (the hit's resolved targets)
   * - 'allies_except_self' -> living same-side participants except actor
   * - 'all_enemies' -> living opposing-side participants
   * `durationOverride` is the pre-modifier base delivered to
   * BuffSystem.apply's M10 channel (node-scaled durations land here).
   * `externalWardGrant` marks a son_nhac_ho_the-style external ward pool
   * granted to the target (resolution: Task 11 external-ward contract).
   */
  /**
   * Legacy singular form (Kiem Tu combo payloads, Phap Tu empowered
   * ults, companion skills). Resolution normalizes
   * `appliesBuffs ?? [appliesBuff]` - 'target' means the action's
   * declared targets, `duration` is the base delivered to BuffSystem.
   */
  appliesBuff?: TurnSkillBuffApplication
  /**
   * Multi-buff application contract (The Tu Reimagined plan Task 6/11,
   * unified with the Kiem Tu plural form). Each entry resolves its
   * target set at impact:
   * - 'self' -> the actor
   * - 'target'/'action_targets' -> declared.affected (resolved targets)
   * - 'allies_except_self' -> living same-side participants except actor
   * - 'all_enemies' -> living opposing-side participants
   * `duration`/`durationOverride` is the pre-modifier base delivered to
   * BuffSystem.apply's M10 channel; `stacks` repeats the apply N times
   * (combo capstones); `externalWardGrant` marks a son_nhac_ho_the-style
   * external ward pool granted to the target.
   */
  appliesBuffs?: TurnSkillBuffApplication[]
  /**
   * The Tu Reimagined (plan Task 6) - buff definitions applied to the
   * OWNER at participant build (the emblem-buff channel). The defs are
   * participant-local clones (node-adjusted via collectBodyKitModifiers),
   * so they ride the def object itself, not a registry id.
   */
  grantsBuffsAtBuild?: import('../../buff2/BuffDefinition').BuffDefinition[]
  /**
   * Phase A1 (2026-09-07) - chance-gated ailment application.
   * Deliberately separate from appliesBuff (unconditional, no chance
   * roll) - different semantics, do not merge the two fields.
   */
  appliesAilment?: TurnSkillAilmentApplication
  /**
   * R3 (AR-03) - Multiple ailment applications on landed hit.
   */
  appliesAilments?: TurnSkillAilmentApplication[]
  // Phase A3 - Phap Tu Detonate: consume the target's stacks of this
  // ailment for bonus true damage (bypasses armor/resistance), then
  // clear them. Ported from legacy SkillEffect.consumesAilmentId/
  // damagePerStack. Only meaningful together with damagePerStack.
  consumesAilmentId?: string
  damagePerStack?: number
  // Phase A3 + Hoa An (spec 2026-09-17 sec.62) -- scope of the
  // consumesAilmentId consume: 'any' = every source's instance (legacy
  // parity, the adapter's default); 'own' = same-source only.
  consumesAilmentScope?: 'own' | 'any'
  // Hoa An (spec sec.62 Xich Viem shared/no) -- scale the direct hit's
  // coefficient by SAME-SOURCE ailment stacks without consuming:
  // coefficient += live stacks x damagePerStack per hit target.
  scalesWithAilmentStacks?: { ailmentId: string; damagePerStack: number }
  // Hoa An (spec sec.62) -- same-source seal interactions appended inside
  // the landed gate AFTER ailment applications, in authored order
  // (Phan Thien: apply -> manual tick -> potency modifier -> extend).
  ailmentInteractions?: readonly SkillAilmentInteraction[]
  // Phase A3 - Tho Tu "shield self-detonates": consume the SOURCE's entire
  // currentWard for bonus true damage, then zero it. Ported from legacy
  // SkillEffect.consumesWardForDamage/damagePerWardPoint. Only meaningful
  // together with damagePerWardPoint.
  consumesWardForDamage?: boolean
  damagePerWardPoint?: number
  /** R3 (AR-03) - Leech healing: heals caster for % of final damage dealt. */
  healPercentOfDamage?: number
  /** Future Systems Task 7 - skill charges for N turns (The) then self-resolves (Tram). */
  chargeTurns?: number
  /** Action Playback (2026-09-05) - VFX preset for action_impact. undefined = default fallback preset (Task 4). */
  presetId?: CombatVfxPresetId
  /**
   * M-QI-05 / QI-D3 - canonical progression owner for internal or
   * generated sub-actions (Kiem Pho combo extras, hidden-body reactive
   * payloads, emblem/stem clones). The level lookup resolves
   * `progressionOwnerId ?? id` against the canonical skill-level
   * projection, so an internal action inherits its parent Core Node
   * level instead of silently falling back to 1. Top-level authored
   * defs leave it undefined. The value must resolve to a registered
   * Core Node's levelsSkillId - never to another internal action.
   */
  progressionOwnerId?: string
  /** Spec sec.7.1 - may this skill be answered by a counter? Defaults to false. */
  counterable?: boolean
  /** Spec sec.7.1 - which skill this actor counters with. Defaults to null. */
  counterSkillId?: string | null
  /**
   * Phap Tu Reimagined Task 8 - The gain is SKILL-AUTHORED, not
   * slot-position-derived. Granted ONCE per cast action that lands on
   * >=1 valid target (target/hit count never multiplies it - a
   * 5-target AoE grants the value once). Clamped at
   * `entity.maxThe ?? MAX_THE` by the engine.
   */
  theGainOnLandedCast?: number
  /**
   * Extra The granted ONCE per cast action when any of its direct hits
   * crits (same per-cast rule - a 5-target all-crit cast adds this
   * once, not per target). Authored by the 'no' route profile.
   */
  theGainOnCrit?: number
  /**
   * Phap Tu Reimagined Task 10 - ultimate empowerment. Attached at
   * battle build by the orchestrator ONLY when the owning
   * `linh_ngo_<godUltId>` node is held (the engine stays dumb - A8).
   * At cast time, `currentThe >= theThreshold` swaps the RESOLVED
   * payload to `empowered` while the root skill keeps cast
   * count/cooldown identity (execution source 'empowered').
   */
  empowerment?: {
    theThreshold: number
    empowered: TurnSkillDefinition
  }
  /**
   * The empowered form carries this: at commit, the caster's ENTIRE
   * currentThe pool burns to 0 (a raised cap burns the whole pool, not
   * just the threshold). The pre-consume amount is captured into
   * `execution.theBurned` at DECLARE for theScaling (Task 13) - the
   * pool is already 0 by the time damage resolves post-commit.
   */
  consumesAllThe?: boolean
  /**
   * Phap Tu Reimagined Task 13 - detonate (the 'dot' route's empowered
   * expression, spec sec.4). After the direct component AND the normal
   * ailment application land, consume every live ailment on each target
   * whose BuffDefinition carries a `dot` effect (utility ailments are
   * never touched); each pays (perTick x remainingTurns x stacks) x amp
   * as direct damage, then re-seeds a FIXED 1 stack at the ailment's
   * AUTHORED duration with potency recomputed against the caster's
   * current stats. Re-seed is not an application event: no chance roll,
   * no ailmentStackBonus (spec O2/R2).
   */
  detonateDoT?: { amp: number }
  /**
   * Phap Tu Reimagined Task 13 - nuke (the 'no' route's empowered
   * expression, spec sec.4): the resolved damage packet scales by
   * (1 + theBurned/100 x coeff); theBurned is the pool captured at
   * declare before consumesAllThe zeroes it. Linear by design -
   * Truong The cap-raises are additive payoff, not diminishing.
   */
  theScaling?: { coeff: number }
  /**
   * Kiem Tu Reimagined Task 2 - multi-instance hit contract (Ngu Kiem Dao
   * phi kiem). The turn engine resolves `count` INDEPENDENT landed-hit
   * pipelines per target through resolveDeclaredHit, stopping early when
   * the target dies. `perInstanceOptions` is called per (instance, live
   * target) so the provider can resolve execute/crit/armor rolls against
   * the CURRENT target state (not a declare-time snapshot).
   * `priorLandedInstances` is the cast-local count of landed prior
   * instances of this cast -- pure runtime state supplied by the
   * instance loop, spanning targets (Ngu Kiem Beta: Kiem The momentum).
   */
  instances?: {
    count: number
    perInstanceOptions?: (instanceIndex: number, target: CombatEntity, priorLandedInstances: number) => Partial<HitResolveOptions>
    /**
     * Skill-definition migration (M4) -- the DECLARATIVE form of
     * perInstanceOptions. Providers emit BOTH: the closure stays the
     * legacy resolveDeclaredHit lane's authority until M5; `each` feeds
     * LegacySkillAdapter -> SkillInstances.each so the plan pipeline
     * carries the same policies declaratively (hit/crit/armor policies
     * on the v1.6 contract payload, execute as a coefficient fold).
     * `momentumPerLandedInstance` models the same Kiem The stack
     * `priorLandedInstances` carries for the closure lane: instance N's
     * coefficient folds (1 + rate * landed-prior-instances).
     */
    each?: {
      guaranteedHit?: boolean
      execute?: { hpPercentBelow: number; damageMultiplier: number }
      critChance?: number
      armorPierce?: { bypassChance: number; pierceFraction: number }
      momentumPerLandedInstance?: number
    }
  }
  /**
   * Emblem-occupying slot def: never selectable by
   * selectAction/selectForcedAction, never deals damage. Two producers:
   * - (retained contract; the Ngu Kiem redesign removed emblem markers - no current producer)
   * - The Tu Reimagined (spec 2026-09-15 section 5.2) - passive emblems;
   *   their permanent buff lands via grantsBuffsAtBuild.
   */
  emblemOnly?: boolean
  /**
   * Reaction M4 (contract sec.70-72) - the action's tag classification
   * for restriction checks (Cam Cong's forbiddenActionTags). When absent
   * the engine infers ['attack'] iff the def carries `damage` (R-E2);
   * explicit tags always win (e.g. ['heal'] on a self-heal special).
   */
  actionTags?: readonly string[]
}

/**
 * Kiem Tu Reimagined Task 2 - post-resolution context handed to a
 * participant's dynamicBasic provider once the action's own hits have
 * landed. `resolvedSkillId` is the id of the definition that actually
 * executed (Hien: the OrbId of the cast orb) - never inferred from
 * provider closure state. `resolveBuff` is the generic channel combo
 * `appliesBuff` content routes through; the provider returns extra hit
 * definitions the engine executes as additive declared impacts.
 */
export interface DynamicBasicCastContext {
  battle: TurnBattle
  actor: TurnBattleParticipant
  resolvedSkillId: string
  landedTargetIds: string[]
  resolveBuff: (
    target: TurnBattleParticipant,
    buff: { definitionId: string; duration?: number; stacks?: number },
  ) => void
}

/**
 * Path-specific basic-attack owner (Kiem Pho preset loop / Ngu Kiem Dao).
 * Attached to TurnBattleParticipant.dynamicBasic; when present it OWNS
 * the basic slot - participant.basic becomes inert.
 */
export interface DynamicBasicProvider {
  /** Auto path - resolves the definition for the next auto basic cast. */
  resolveBasic(participant: TurnBattleParticipant): TurnSkillDefinition
  /** Definitions the manual UI may legitimately submit. */
  manualOptions?(): readonly TurnSkillDefinition[]
  /**
   * Manual submit path - validate defId against manualOptions() and return
   * the matching definition, or null to fall back to normal selection.
   * Must NOT advance auto-path state (cursor).
   */
  resolveManualPick?(defId: string): TurnSkillDefinition | null
  /** Battle boundary reset (auto-repeat reuses participants). */
  resetForBattle?(): void
  /**
   * Fires once per resolved committed action of this actor (after the
   * action's own hits). Returns extra declared-impact definitions (combo
   * payloads) the engine executes through the same landed-hit pipeline.
   */
  onCastResolved?(ctx: DynamicBasicCastContext): readonly TurnSkillDefinition[]
}

/** Manual submit choice - a slot role or a dynamic-basic definition pick. */
export type ForcedTurnChoice = TurnSkillSlotRole | { kind: 'dynamic_basic'; defId: string }

export interface TurnSkillSlot {
  skill: TurnSkillDefinition
  remainingCooldownTurns: number
}

const RESOURCE_FIELD: Record<
  Exclude<SkillResourceType, 'none'>,
  'currentMp' | 'currentThe'
> = {
  mana: 'currentMp',
  the: 'currentThe',
}

/**
 * Simplification (design spec sec.3, "explicitly out of scope: content
 * migration") - checks the resource pool directly, no per-path
 * consumption order. Real content mapping resolves this later.
 */
export function hasResourceFor(entity: CombatEntity, skill: TurnSkillDefinition): boolean {
  if (!skill.resourceType || skill.resourceType === 'none' || !skill.resourceCost) {
    return true
  }

  const field = RESOURCE_FIELD[skill.resourceType]

  // currentThe is optional on CombatEntity - an uninitialized pool reads as
  // undefined, which correctly blocks the cast (undefined >= cost is false).
  return (entity[field] ?? 0) >= skill.resourceCost
}

export function consumeResourceFor(
  entity: CombatEntity,
  skill: Pick<TurnSkillDefinition, 'resourceType' | 'resourceCost'>,
): void {
  if (!skill.resourceType || skill.resourceType === 'none' || !skill.resourceCost) {
    return
  }

  const field = RESOURCE_FIELD[skill.resourceType]

  entity[field] -= skill.resourceCost
}

export interface SelectedAction {
  skillId: string
  skill: TurnSkillDefinition | null
  damage?: ActionDamageInfo
  targeting: ActionTargeting
  slot: TurnSkillSlot | null
}

/**
 * Phap Tu Reimagined Task 9 - the cast's execution identity. Separates
 * the skill that OWNS the cast (cast count, slot cooldown, root
 * identity, progression identity - always `rootSkillId`) from the
 * payload actually resolving (`resolvedSkill` - damage/ailments/
 * targeting/runtime combat fields).
 *
 * source:
 * - 'original'   - a normal slot/basic cast (root === payload)
 * - 'empowered'  - the root ult's empowered payload resolved
 *                  (root = the chain-E slot's root skill; the god-ult def
 *                  is payload only - never gains cast count/cooldown)
 * - 'composite'  - a composite cast whose payload was picked from a
 *                  pool (e.g. van_phap_tuy_tam); the pick never gains
 *                  its own cast count
 * - 'repeat'     - an extra execution of the same cast (da_phap_lien_tuyen)
 * - 'multicast'  - an extra execution spawned by the multicast passive
 *
 * 'repeat'/'multicast' executions are follow-ups: they must NOT
 * re-consume the slot cooldown or fire the cast sink (the root cast
 * already committed). multicast-sourced basic executions may roll
 * multicast again until the depth cap; repeat-sourced never do.
 */
export type TurnExecutionSource = 'original' | 'empowered' | 'composite' | 'repeat' | 'multicast'

export interface TurnSkillExecution {
  rootSkillId: string
  resolvedSkill: TurnSkillDefinition | null
  source: TurnExecutionSource
  /**
   * Task 10 - the The pool captured pre-consume when a `consumesAllThe`
   * payload commits. Read by theScaling (Task 13); undefined for any
   * execution that did not burn the pool.
   */
  theBurned?: number
  /**
   * Task 11 - multicast chain position: 0/undefined for the original
   * cast, N for the Nth multicast-sourced follow-up. Bounds the re-roll
   * (a multicast execution rolls again only while depth <
   * min(multicast.maxExtraCasts, MAX_MULTICAST)).
   */
  multicastDepth?: number
}

/**
 * Phap Tu An (Task 11) - a queued follow-up execution of an
 * already-committed cast. Drained by the engine's follow-up path as a
 * gauge-free bypass action that re-resolves the root skill's payload
 * (composite picks re-roll per execution). Structurally bounded:
 * 'repeat' entries number exactly rootSkill.repeatCasts; 'multicast'
 * entries are depth-capped by MAX_MULTICAST.
 */
export interface TurnQueuedExecution {
  actorId: string
  rootSkill: TurnSkillDefinition
  source: 'repeat' | 'multicast'
  multicastDepth: number
}

/**
 * Hard bound on multicast re-casts per original cast (spec: An's
 * multicast storm is capped at MAX_MULTICAST extra executions). The
 * authored `multicast.maxExtraCasts` may set a lower bound; the engine
 * enforces min(authored, this).
 */
export const MAX_MULTICAST = 3

/** Does this execution own a real cast (commit cooldown + cast sink)? */
export function executionCommitsCast(execution: TurnSkillExecution | undefined): boolean {
  return execution === undefined || (execution.source !== 'repeat' && execution.source !== 'multicast')
}

const FALLBACK_BASIC_ATTACK: ActionDamageInfo = { kind: 'physical', multiplier: 1 }

const FALLBACK_TARGETING: ActionTargeting = { shape: 'single' }

/**
 * skilldef M5d -- the Slice-1 hardcoded basic attack is a real def (not
 * skill:null) so runtime battles route it through the plan pipeline
 * like every other cast. Identity stays 'basic_attack'; it carries no
 * slot/cooldown/cost by construction.
 */
const FALLBACK_BASIC_SKILL: TurnSkillDefinition = {
  id: 'basic_attack',
  cooldownTurns: 0,
  damage: FALLBACK_BASIC_ATTACK,
  targeting: FALLBACK_TARGETING,
}

/**
 * Reaction M4 (R-E) - the sealed no-action. Produced when every
 * candidate is forbidden by the actor's restriction set (Cam Cong):
 * NOT a stun -- declareActorAction converts skillId '' into the same
 * empty-turn shape as the existing no-action return (action: null).
 */
export const NULL_ACTION: SelectedAction = {
  skillId: '',
  skill: null,
  targeting: FALLBACK_TARGETING,
  slot: null,
}

/**
 * Ticks special/ultimate cooldowns down by 1, floored at 0 - cooldown
 * counts the ACTOR's own turns (this rework's "tick at the holder's own
 * turn" convention, already used by BuffSystem). Call once per actor
 * per turn, BEFORE selectAction().
 *
 * `exclude` - slots to skip this tick: declareActorAction passes the
 * slots whose cooldown was (re)committed during THIS turn's pre-action
 * status phase (e.g. a lethal-DoT survive trigger spending the ult slot
 * inside BuffSystem.update). A fresh commit starts counting from the
 * holder's NEXT own turn - it must not lose a turn to the tick that
 * immediately follows the phase that committed it.
 */
export function tickCooldowns(
  participant: TurnBattleParticipant,
  exclude?: ReadonlySet<TurnSkillSlot>,
): void {
  if (participant.special && !exclude?.has(participant.special)) {
    participant.special.remainingCooldownTurns = Math.max(0, participant.special.remainingCooldownTurns - 1)
  }

  if (participant.ultimate && !exclude?.has(participant.ultimate)) {
    participant.ultimate.remainingCooldownTurns = Math.max(0, participant.ultimate.remainingCooldownTurns - 1)
  }
}

function slotAction(slot: TurnSkillSlot): SelectedAction {
  return {
    skillId: slot.skill.id,
    skill: slot.skill,
    damage: slot.skill.damage,
    targeting: slot.skill.targeting,
    slot,
  }
}

/**
 * Basic-slot resolution - the dynamicBasic provider OWNS the slot when
 * present (Kiem Tu Reimagined Task 2): participant.basic is inert for
 * those actors. Falls back to the static basic, then the hardcoded
 * Slice-1 fallback attack.
 */
function basicAction(participant: TurnBattleParticipant): SelectedAction {
  const def = participant.dynamicBasic?.resolveBasic(participant) ?? participant.basic

  if (def) {
    return {
      skillId: def.id,
      skill: def,
      damage: def.damage,
      targeting: def.targeting,
      slot: null,
    }
  }

  return {
    skillId: 'basic_attack',
    skill: FALLBACK_BASIC_SKILL,
    damage: FALLBACK_BASIC_ATTACK,
    targeting: FALLBACK_TARGETING,
    slot: null,
  }
}

function slotReady(slot: TurnSkillSlot | undefined, participant: TurnBattleParticipant): slot is TurnSkillSlot {
  return (
    slot !== undefined &&
    !slot.skill.emblemOnly &&
    slot.remainingCooldownTurns === 0 &&
    hasResourceFor(participant.entity, slot.skill)
  )
}

/**
 * Priority: ultimate (off cooldown + affordable) -> special (same) ->
 * basic (no cooldown/cost by construction) -> hardcoded fallback basic
 * attack when the participant has no `basic` set at all (Slice 1
 * backward compatibility - see plan Task 4).
 *
 * Reaction M4 - `forbidden` is the actor's action-tag restriction set
 * (Cam Cong via ActionValidator). Forbidden candidates are skipped in
 * priority order; when every candidate is sealed the actor gets the
 * NULL_ACTION empty turn (R-E), never a silently-forbidden pick.
 */
export function selectAction(
  participant: TurnBattleParticipant,
  forbidden?: ReadonlySet<string>,
): SelectedAction {
  if (slotReady(participant.ultimate, participant)) {
    const candidate = slotAction(participant.ultimate!)

    if (isActionAllowed(candidate, forbidden)) {
      return candidate
    }
  }

  if (slotReady(participant.special, participant)) {
    const candidate = slotAction(participant.special!)

    if (isActionAllowed(candidate, forbidden)) {
      return candidate
    }
  }

  const basic = basicAction(participant)

  return isActionAllowed(basic, forbidden) ? basic : NULL_ACTION
}

/**
 * Slice 7 - the 3 fixed skill roles the manual UI can force-cast. Basic is
 * always ready (no cooldown/cost by construction); special/ultimate go through
 * the real readiness checks of selectAction() (cooldown + resource) - an unready
 * slot is silently SKIPPED (the UI disables unready buttons first; this is
 * only a defensive backstop, not an error path - spec Slice 7 sec.2).
 */
export type TurnSkillSlotRole = 'basic' | 'special' | 'ultimate'

/**
 * Forces one specific role slot when that role is ready; otherwise falls back
 * to normal priority (selectAction). Basic = participant.basic (or fallback
 * when unset), always ready by construction.
 */
export function selectForcedAction(
  participant: TurnBattleParticipant,
  forced: ForcedTurnChoice,
  forbidden?: ReadonlySet<string>,
): SelectedAction {
  // Kiem Tu Reimagined Task 2 - a dynamic_basic pick travels the SAME
  // manual-submit channel as slot roles; the provider validates the id
  // against its own manualOptions (invalid -> normal selection). Manual
  // picks never advance the provider's auto cursor.
  // Reaction M4 - a manual pick whose tags are forbidden is rejected
  // like any other invalid pick (falls to restricted selection; the
  // seal cannot be bypassed through the forced channel).
  if (typeof forced === 'object') {
    const picked = participant.dynamicBasic?.resolveManualPick?.(forced.defId) ?? null

    if (picked) {
      const candidate: SelectedAction = {
        skillId: picked.id,
        skill: picked,
        damage: picked.damage,
        targeting: picked.targeting,
        slot: null,
      }

      return isActionAllowed(candidate, forbidden)
        ? candidate
        : selectAction(participant, forbidden)
    }

    return selectAction(participant, forbidden)
  }

  if (forced === 'basic') {
    if (participant.basic || participant.dynamicBasic) {
      const basic = basicAction(participant)

      return isActionAllowed(basic, forbidden)
        ? basic
        : selectAction(participant, forbidden)
    }

    return selectAction(participant, forbidden)
  }

  const slot = forced === 'special' ? participant.special : participant.ultimate

  if (slotReady(slot, participant)) {
    const candidate = slotAction(slot)

    if (isActionAllowed(candidate, forbidden)) {
      return candidate
    }
  }

  return selectAction(participant, forbidden)
}

/**
 * Phap Tu An (Task 11) - uniform pick of `count` DISTINCT defs from a
 * composite pool via the injected rng (partial Fisher-Yates). All new
 * An-kit randomness routes through the system's injected rng - never
 * global Math.random - so tests are deterministic.
 */
export function pickCompositePool(
  pool: readonly TurnSkillDefinition[],
  count: number,
  rng: () => number,
): TurnSkillDefinition[] {
  const remaining = [...pool]
  const picks: TurnSkillDefinition[] = []

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const index = Math.floor(rng() * remaining.length)
    picks.push(remaining.splice(index, 1)[0]!)
  }

  return picks
}

/** Sets the used slot on cooldown and consumes its resource - call AFTER a successful cast (a target was actually hit). No-op for the basic fallback (slot is null). */
export function commitAction(entity: CombatEntity, action: SelectedAction): void {
  if (action.slot) {
    action.slot.remainingCooldownTurns = action.slot.skill.cooldownTurns
  }

  if (action.skill) {
    consumeResourceFor(entity, action.skill)
  }
}

/**
 * AOE target collection for TurnBattle - the same shape-filter logic the
 * retired grid-battle collectAffected() used, but over
 * TurnBattleParticipant[] (no Battle coupling). The primary target is
 * always included even when the shape math would exclude it - the
 * "primary always hits" guarantee.
 */
export function collectTurnTargets(
  primaryTarget: TurnBattleParticipant,
  opposingSide: TurnBattleParticipant[],
  targeting: ActionTargeting,
): TurnBattleParticipant[] {
  const anchor = entityGridPosition(primaryTarget.entity)

  const inShape = (position: GridPosition): boolean => {
    if (targeting.shape === 'cross') {
      const spec: AoeShapeSpec = { shape: 'cross', radius: targeting.laneRadius ?? 0 }

      return isCellInShape(anchor, spec, position)
    }

    const area = areaFor(anchor.row, anchor.column, targeting)

    if (!area) {
      return false
    }

    return (
      position.row >= area.rowStart &&
      position.row <= area.rowEnd &&
      position.column >= area.colStart &&
      position.column <= area.colEnd
    )
  }

  const living = opposingSide.filter((participant) => participant.entity.alive)

  const affected = living.filter((participant) => {
    if (participant.id === primaryTarget.id) {
      return true
    }

    return inShape(entityGridPosition(participant.entity))
  })

  return affected.length > 0 ? affected : [primaryTarget]
}
