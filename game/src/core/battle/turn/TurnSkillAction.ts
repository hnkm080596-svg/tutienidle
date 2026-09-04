// Turn-Based Combat Slice 2 (spec 2026-09-04) — skill selection, resource
// gating, and AOE target collection for TurnBattleSystem.resolveNextStep().
// Kept in its own file (separate from TurnBattleSystem.ts) matching the
// existing ActionGauge.ts/TurnQueue.ts one-concern-per-file pattern.
import type { CombatEntity } from '../../combat/CombatEntity'
import type { SkillResourceType } from '../../skill/SkillTypes'
import type { ActionDamageInfo } from '../ActionImpactSystem'
import type { ActionTargeting } from '../CombatAction'
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
export interface TurnSkillDefinition {
  id: string
  cooldownTurns: number
  resourceType?: SkillResourceType
  resourceCost?: number
  damage: ActionDamageInfo
  targeting: ActionTargeting
}

export interface TurnSkillSlot {
  skill: TurnSkillDefinition
  remainingCooldownTurns: number
}

const RESOURCE_FIELD: Record<
  Exclude<SkillResourceType, 'none'>,
  'currentMp' | 'currentSwordIntent' | 'currentMomentum'
> = {
  mana: 'currentMp',
  sword_intent: 'currentSwordIntent',
  momentum: 'currentMomentum',
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

  return entity[field] >= skill.resourceCost
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
  damage: ActionDamageInfo
  targeting: ActionTargeting
  slot: TurnSkillSlot | null
}

const FALLBACK_BASIC_ATTACK: ActionDamageInfo = { kind: 'physical', multiplier: 1 }

const FALLBACK_TARGETING: ActionTargeting = { shape: 'single' }

/**
 * Ticks special/ultimate cooldowns down by 1, floored at 0 — cooldown
 * counts the ACTOR's own turns (this rework's "tick at the holder's own
 * turn" convention, already used by TurnBuffSystem). Call once per actor
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
