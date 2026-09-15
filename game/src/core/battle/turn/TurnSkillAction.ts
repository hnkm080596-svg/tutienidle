// Turn-Based Combat Slice 2 (spec 2026-09-04) — skill selection, resource
// gating, and AOE target collection for TurnBattleSystem.resolveNextStep().
// Kept in its own file (separate from TurnBattleSystem.ts) matching the
// existing ActionGauge.ts/TurnQueue.ts one-concern-per-file pattern.
import type { CombatEntity } from '../../combat/CombatEntity'
import type { SkillResourceType } from '../../skill/SkillTypes'
import type { ActionDamageInfo } from '../ActionImpactSystem'
import type { ActionTargeting, CombatVfxPresetId } from '../CombatAction'
import type { TurnBattleParticipant } from './TurnBattleSystem'
import { areaFor } from '../ActionTargetingSystem'
import { entityGridPosition, type GridPosition } from '../BattleGrid'
import { isCellInShape, type AoeShapeSpec } from './AoeShape'

/**
 * Slice 2 skill shape — deliberately NOT the live `Skill` interface
 * (Skill.ts carries 30+ fields for progression/UI/passive concerns this
 * slice doesn't touch). Field names/types mirror the live fields this
 * slice DOES reuse (SkillResourceType, ActionDamageInfo, ActionTargeting)
 * so future content-mapping from real Skill objects is a straight field
 * copy, not a redesign — see design spec §3.
 */
export interface TurnSkillAilmentApplication {
  buffDefinitionId: string
  chance: number
  stacks?: number
}

export interface TurnSkillDefinition {
  id: string
  cooldownTurns: number
  /**
   * R3 (AR-03) — Explicit target scope. Defaults to 'enemy'.
   * 'self' targets the caster without dealing damage.
   */
  targetScope?: 'enemy' | 'self'
  resourceType?: SkillResourceType
  resourceCost?: number
  damage?: ActionDamageInfo
  targeting: ActionTargeting
  /**
   * R3 (AR-18) — Generic composite action policy. Replaces hardcoded
   * content ID checks in the turn engine.
   *
   * 'reaction_path' — legacy lane: the pool arrives constructor-injected
   * (reactionPathPool). Retired content, dies with the Task 14 kill list.
   *
   * 'element_basic' — Phap Tu An (Task 11): the orchestrator attaches the
   * resolved pool ON the def; the engine picks `count` distinct defs
   * uniformly via the injected rng and resolves picks[0] as THE payload
   * (damage/ailments/targeting — the pick executes as the cast). Any
   * extra picks (count > 1) apply damage+ailments through the shared
   * composite-picks lane. The picked def never owns cast identity —
   * rootSkillId keeps cast count/cooldown (INV-18).
   */
  compositePicks?:
    | { poolType: 'reaction_path'; count: number }
    | {
        poolType: 'element_basic'
        count: number
        pool: readonly TurnSkillDefinition[]
      }
  /**
   * Phap Tu An (Task 11) — extra executions of this action, queued as
   * follow-up executions at cast completion (source 'repeat'). Each
   * repeat re-resolves the payload (re-rolls compositePicks). Repeat
   * executions never re-commit cooldown/cast count and never roll
   * multicast (P15).
   */
  repeatCasts?: number
  /**
   * Phap Tu An (Task 11) — multicast passive (ngo_dao_hon_don), attached
   * to the An basic def by the orchestrator. After an original/composite
   * or multicast-sourced execution of this skill completes, roll
   * `chance` via the injected rng — success queues one more execution
   * (source 'multicast'), which re-rolls its own pick and may roll again.
   * Total extra executions per cast are bounded by
   * min(maxExtraCasts, MAX_MULTICAST).
   */
  multicast?: {
    chance: number
    maxExtraCasts: number
  }
  /**
   * M10 (ARCH-008) — `duration` carries the authored SkillEffect.duration
   * override through the converter (e.g. duong_linh_tuyen spec: 8 instead
   * of the buff definition's registry default). undefined = registry
   * default, unchanged behavior.
   */
  appliesBuff?: { definitionId: string; target: 'self' | 'target'; duration?: number }
  /**
   * Phase A1 (2026-09-07) — chance-gated ailment application, checked
   * against TurnReactionManager after applying. Deliberately separate
   * from appliesBuff (unconditional, no reaction check) — different
   * semantics, do not merge the two fields.
   */
  appliesAilment?: TurnSkillAilmentApplication
  /**
   * R3 (AR-03) — Multiple ailment applications on landed hit.
   */
  appliesAilments?: TurnSkillAilmentApplication[]
  // Phase A3 — Pháp Tu Detonate: consume the target's stacks of this
  // ailment for bonus true damage (bypasses armor/resistance), then
  // clear them. Ported from legacy SkillEffect.consumesAilmentId/
  // damagePerStack. Only meaningful together with damagePerStack.
  consumesAilmentId?: string
  damagePerStack?: number
  // Phase A3 — Thổ Tu "tự nổ khiên": consume the SOURCE's entire
  // currentWard for bonus true damage, then zero it. Ported from legacy
  // SkillEffect.consumesWardForDamage/damagePerWardPoint. Only meaningful
  // together with damagePerWardPoint.
  consumesWardForDamage?: boolean
  damagePerWardPoint?: number
  /** R3 (AR-03) — Leech healing: heals caster for % of final damage dealt. */
  healPercentOfDamage?: number
  /** Future Systems Task 7 — skill charge N lượt (Thế) rồi tự resolve (Trảm). */
  chargeTurns?: number
  /** Action Playback (2026-09-05) — VFX preset cho action_impact. undefined = fallback preset mặc định (Task 4). */
  presetId?: CombatVfxPresetId
  /** Spec §7.1 — may this skill be answered by a counter? Defaults to false. */
  counterable?: boolean
  /** Spec §7.1 — which skill this actor counters with. Defaults to null. */
  counterSkillId?: string | null
  /**
   * Phap Tu Reimagined Task 8 — The gain is SKILL-AUTHORED, not
   * slot-position-derived. Granted ONCE per cast action that lands on
   * >=1 valid target (target/hit count never multiplies it — a
   * 5-target AoE grants the value once). Clamped at
   * `entity.maxThe ?? MAX_THE` by the engine.
   */
  theGainOnLandedCast?: number
  /**
   * Extra The granted ONCE per cast action when any of its direct hits
   * crits (same per-cast rule — a 5-target all-crit cast adds this
   * once, not per target). Authored by the 'no' route profile.
   */
  theGainOnCrit?: number
  /**
   * Phap Tu Reimagined Task 10 — ultimate empowerment. Attached at
   * battle build by the orchestrator ONLY when the owning
   * `linh_ngo_<godUltId>` node is held (the engine stays dumb — A8).
   * At cast time, `currentThe >= theThreshold` swaps the RESOLVED
   * payload to `empowered` while the equipped skill keeps cast
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
   * `execution.theBurned` at DECLARE for theScaling (Task 13) — the
   * pool is already 0 by the time damage resolves post-commit.
   */
  consumesAllThe?: boolean
  /**
   * Phap Tu Reimagined Task 13 — detonate (the 'dot' route's empowered
   * expression, spec §4). After the direct component AND the normal
   * ailment application land, consume every live ailment on each target
   * whose BuffDefinition carries a `dot` effect (utility ailments are
   * never touched); each pays (perTick x remainingTurns x stacks) x amp
   * as direct damage, then re-seeds a FIXED 1 stack at the ailment's
   * AUTHORED duration with potency recomputed against the caster's
   * current stats. Re-seed is not an application event: no chance roll,
   * no ailmentStackBonus, and reaction-silent — never fires
   * TurnReactionManager (spec O2/R2).
   */
  detonateDoT?: { amp: number }
  /**
   * Phap Tu Reimagined Task 13 — nuke (the 'no' route's empowered
   * expression, spec §4): the resolved damage packet scales by
   * (1 + theBurned/100 x coeff); theBurned is the pool captured at
   * declare before consumesAllThe zeroes it. Linear by design —
   * Truong The cap-raises are additive payoff, not diminishing.
   */
  theScaling?: { coeff: number }
}

export interface TurnSkillSlot {
  skill: TurnSkillDefinition
  remainingCooldownTurns: number
}

const RESOURCE_FIELD: Record<
  Exclude<SkillResourceType, 'none'>,
  'currentMp' | 'currentSwordIntent' | 'currentMomentum' | 'currentThe'
> = {
  mana: 'currentMp',
  sword_intent: 'currentSwordIntent',
  momentum: 'currentMomentum',
  the: 'currentThe',
}

/**
 * Simplification (design spec §3, "explicitly out of scope: content
 * migration") — checks the resource pool directly, no Kiếm Ý temp-first
 * consumption rule (KiemTuResourceSystem.consumeKiemYTempFirst) or other
 * per-path consumption order. Real content mapping resolves this later.
 */
export function hasResourceFor(entity: CombatEntity, skill: TurnSkillDefinition): boolean {
  if (!skill.resourceType || skill.resourceType === 'none' || !skill.resourceCost) {
    return true
  }

  const field = RESOURCE_FIELD[skill.resourceType]

  // currentThe is optional on CombatEntity — an uninitialized pool reads as
  // undefined, which correctly blocks the cast (undefined >= cost is false).
  return (entity[field] ?? 0) >= skill.resourceCost
}

export function consumeResourceFor(entity: CombatEntity, skill: TurnSkillDefinition): void {
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
 * Phap Tu Reimagined Task 9 — the cast's execution identity. Separates
 * the skill that OWNS the cast (cast count, slot cooldown, equipped
 * identity, progression identity — always `rootSkillId`) from the
 * payload actually resolving (`resolvedSkill` — damage/ailments/
 * targeting/runtime combat fields).
 *
 * source:
 * - 'original'   — a normal slot/basic cast (root === payload)
 * - 'empowered'  — the equipped ult's empowered payload resolved
 *                  (root = the equipped chain-E skill; the god-ult def
 *                  is payload only — never gains cast count/cooldown)
 * - 'composite'  — a composite cast whose payload was picked from a
 *                  pool (e.g. van_phap_tuy_tam); the pick never gains
 *                  its own cast count
 * - 'repeat'     — an extra execution of the same cast (da_phap_lien_tuyen)
 * - 'multicast'  — an extra execution spawned by the multicast passive
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
   * Task 10 — the The pool captured pre-consume when a `consumesAllThe`
   * payload commits. Read by theScaling (Task 13); undefined for any
   * execution that did not burn the pool.
   */
  theBurned?: number
  /**
   * Task 11 — multicast chain position: 0/undefined for the original
   * cast, N for the Nth multicast-sourced follow-up. Bounds the re-roll
   * (a multicast execution rolls again only while depth <
   * min(multicast.maxExtraCasts, MAX_MULTICAST)).
   */
  multicastDepth?: number
}

/**
 * Phap Tu An (Task 11) — a queued follow-up execution of an
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
 * Ticks special/ultimate cooldowns down by 1, floored at 0 — cooldown
 * counts the ACTOR's own turns (this rework's "tick at the holder's own
 * turn" convention, already used by BuffSystem). Call once per actor
 * per turn, BEFORE selectAction().
 */
export function tickCooldowns(participant: TurnBattleParticipant): void {
  if (participant.special) {
    participant.special.remainingCooldownTurns = Math.max(0, participant.special.remainingCooldownTurns - 1)
  }

  if (participant.ultimate) {
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
 * Priority: ultimate (off cooldown + affordable) -> special (same) ->
 * basic (no cooldown/cost by construction) -> hardcoded fallback basic
 * attack when the participant has no `basic` set at all (Slice 1
 * backward compatibility — see plan Task 4).
 */
export function selectAction(participant: TurnBattleParticipant): SelectedAction {
  if (
    participant.ultimate &&
    participant.ultimate.remainingCooldownTurns === 0 &&
    hasResourceFor(participant.entity, participant.ultimate.skill)
  ) {
    return slotAction(participant.ultimate)
  }

  if (
    participant.special &&
    participant.special.remainingCooldownTurns === 0 &&
    hasResourceFor(participant.entity, participant.special.skill)
  ) {
    return slotAction(participant.special)
  }

  if (participant.basic) {
    return {
      skillId: participant.basic.id,
      skill: participant.basic,
      damage: participant.basic.damage,
      targeting: participant.basic.targeting,
      slot: null,
    }
  }

  return {
    skillId: 'basic_attack',
    skill: null,
    damage: FALLBACK_BASIC_ATTACK,
    targeting: FALLBACK_TARGETING,
    slot: null,
  }
}

/**
 * Slice 7 — 3 skill role cố định mà manual UI ép cast được. Basic luôn
 * ready (no cooldown/cost by construction); special/ultimate đi qua đúng
 * readiness checks của selectAction() (cooldown + resource) — slot không
 * sẵn sàng bị BỎ QUA im lặng (UI disable nút không sẵn sàng trước, đây
 * chỉ là defensive backstop, không phải error path — spec Slice 7 §2).
 */
export type TurnSkillSlotRole = 'basic' | 'special' | 'ultimate'

/**
 * Ép 1 slot role cụ thể khi role đó ready; ngược lại rơi về priority
 * thường (selectAction). Basic = participant.basic (hoặc fallback khi
 * không set), luôn ready by construction.
 */
export function selectForcedAction(
  participant: TurnBattleParticipant,
  role: TurnSkillSlotRole,
): SelectedAction {
  if (role === 'basic') {
    if (participant.basic) {
      return {
        skillId: participant.basic.id,
        skill: participant.basic,
        damage: participant.basic.damage,
        targeting: participant.basic.targeting,
        slot: null,
      }
    }

    return selectAction(participant)
  }

  const slot = role === 'special' ? participant.special : participant.ultimate

  if (
    slot &&
    slot.remainingCooldownTurns === 0 &&
    hasResourceFor(participant.entity, slot.skill)
  ) {
    return slotAction(slot)
  }

  return selectAction(participant)
}

/**
 * Future Systems Task 4 — Reaction Path: chọn ngẫu nhiên 2 skill KHÁC
 * nhau từ pool (đảm bảo mỗi lần cast special đều có cơ hội kích reaction
 * — spec §3). Fisher-Yates 2 bước thay vì sort-random (không ổn định).
 */
export function selectRandomDistinctElementPair(
  pool: TurnSkillDefinition[],
  rng: () => number = Math.random,
): [TurnSkillDefinition, TurnSkillDefinition] {
  if (pool.length < 2) {
    throw new Error('selectRandomDistinctElementPair requires at least 2 skills in the pool')
  }

  const firstIndex = Math.floor(rng() * pool.length)

  let secondIndex = Math.floor(rng() * (pool.length - 1))

  if (secondIndex >= firstIndex) {
    secondIndex += 1
  }

  return [pool[firstIndex]!, pool[secondIndex]!]
}

/**
 * Phap Tu An (Task 11) — uniform pick of `count` DISTINCT defs from a
 * composite pool via the injected rng (partial Fisher-Yates). All new
 * An-kit randomness routes through the system's injected rng — never
 * global Math.random — so tests are deterministic.
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

/** Sets the used slot on cooldown and consumes its resource — call AFTER a successful cast (a target was actually hit). No-op for the basic fallback (slot is null). */
export function commitAction(entity: CombatEntity, action: SelectedAction): void {
  if (action.slot) {
    action.slot.remainingCooldownTurns = action.slot.skill.cooldownTurns
  }

  if (action.skill) {
    consumeResourceFor(entity, action.skill)
  }
}

/**
 * AOE target collection for TurnBattle — mirrors ActionTargetingSystem.
 * collectAffected()'s shape-filter logic, but over TurnBattleParticipant[]
 * instead of a live Battle (Slice 1/2 stays standalone, no Battle
 * coupling). The primary target is always included even when the shape
 * math would exclude it, matching live collectAffected()'s "primary
 * always hits" guarantee.
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
