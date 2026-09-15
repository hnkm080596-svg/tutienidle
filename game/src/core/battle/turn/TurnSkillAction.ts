// Turn-Based Combat Slice 2 (spec 2026-09-04) — skill selection, resource
// gating, and AOE target collection for TurnBattleSystem.resolveNextStep().
// Kept in its own file (separate from TurnBattleSystem.ts) matching the
// existing ActionGauge.ts/TurnQueue.ts one-concern-per-file pattern.
import type { CombatEntity } from '../../combat/CombatEntity'
import type { SkillResourceType } from '../../skill/SkillTypes'
import type { ActionDamageInfo, HitResolveOptions } from '../ActionImpactSystem'
import type { ActionTargeting, CombatVfxPresetId } from '../CombatAction'
import type { TurnBattle, TurnBattleParticipant } from './TurnBattleSystem'
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
   */
  compositePicks?: {
    poolType: 'reaction_path'
    count: number
  }
  /**
   * M10 (ARCH-008) — `duration` carries the authored SkillEffect.duration
   * override through the converter (e.g. duong_linh_tuyen spec: 8 instead
   * of the buff definition's registry default). undefined = registry
   * default, unchanged behavior.
   */
  appliesBuff?: { definitionId: string; target: 'self' | 'target'; duration?: number; stacks?: number }
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
   * Kiem Tu Reimagined Task 2 — multi-instance hit contract (Ngu Kiem Dao
   * phi kiem). The turn engine resolves `count` INDEPENDENT landed-hit
   * pipelines per target through resolveDeclaredHit, stopping early when
   * the target dies. `perInstanceOptions` is called per (instance, live
   * target) so the provider can resolve execute/crit/armor rolls against
   * the CURRENT target state (not a declare-time snapshot).
   */
  instances?: {
    count: number
    perInstanceOptions?: (instanceIndex: number, target: CombatEntity) => Partial<HitResolveOptions>
  }
  /**
   * Kiem Tu Reimagined Task 9 — HUD emblem marker (Ngu Kiem Dao's
   * special/ultimate slot indicators). An emblem def RENDERS on the bar
   * but is never selectable: selectAction/selectForcedAction skip slots
   * carrying one. Marker defs carry no damage/effects — they exist so
   * presentation has a slot occupant to label.
   */
  emblemOnly?: boolean
}

/**
 * Kiem Tu Reimagined Task 2 — post-resolution context handed to a
 * participant's dynamicBasic provider once the action's own hits have
 * landed. `resolvedSkillId` is the id of the definition that actually
 * executed (Hien: the OrbId of the cast orb) — never inferred from
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
 * Path-specific basic-attack owner (Kiem Pho preset loop / Ngự Kiem Dao).
 * Attached to TurnBattleParticipant.dynamicBasic; when present it OWNS
 * the basic slot — participant.basic becomes inert.
 */
export interface DynamicBasicProvider {
  /** Auto path — resolves the definition for the next auto basic cast. */
  resolveBasic(participant: TurnBattleParticipant): TurnSkillDefinition
  /** Definitions the manual UI may legitimately submit. */
  manualOptions?(): readonly TurnSkillDefinition[]
  /**
   * Manual submit path — validate defId against manualOptions() and return
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

/** Manual submit choice — a slot role or a dynamic-basic definition pick. */
export type ForcedTurnChoice = TurnSkillSlotRole | { kind: 'dynamic_basic'; defId: string }

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
 * Basic-slot resolution — the dynamicBasic provider OWNS the slot when
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
    skill: null,
    damage: FALLBACK_BASIC_ATTACK,
    targeting: FALLBACK_TARGETING,
    slot: null,
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
    !participant.ultimate.skill.emblemOnly &&
    participant.ultimate.remainingCooldownTurns === 0 &&
    hasResourceFor(participant.entity, participant.ultimate.skill)
  ) {
    return slotAction(participant.ultimate)
  }

  if (
    participant.special &&
    !participant.special.skill.emblemOnly &&
    participant.special.remainingCooldownTurns === 0 &&
    hasResourceFor(participant.entity, participant.special.skill)
  ) {
    return slotAction(participant.special)
  }

  return basicAction(participant)
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
  forced: ForcedTurnChoice,
): SelectedAction {
  // Kiem Tu Reimagined Task 2 — a dynamic_basic pick travels the SAME
  // manual-submit channel as slot roles; the provider validates the id
  // against its own manualOptions (invalid -> normal selection). Manual
  // picks never advance the provider's auto cursor.
  if (typeof forced === 'object') {
    const picked = participant.dynamicBasic?.resolveManualPick?.(forced.defId) ?? null

    if (picked) {
      return {
        skillId: picked.id,
        skill: picked,
        damage: picked.damage,
        targeting: picked.targeting,
        slot: null,
      }
    }

    return selectAction(participant)
  }

  if (forced === 'basic') {
    if (participant.basic || participant.dynamicBasic) {
      return basicAction(participant)
    }

    return selectAction(participant)
  }

  const slot = forced === 'special' ? participant.special : participant.ultimate

  if (
    slot &&
    !slot.skill.emblemOnly &&
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
): [TurnSkillDefinition, TurnSkillDefinition] {
  if (pool.length < 2) {
    throw new Error('selectRandomDistinctElementPair requires at least 2 skills in the pool')
  }

  const firstIndex = Math.floor(Math.random() * pool.length)

  let secondIndex = Math.floor(Math.random() * (pool.length - 1))

  if (secondIndex >= firstIndex) {
    secondIndex += 1
  }

  return [pool[firstIndex]!, pool[secondIndex]!]
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
