// Turn-Based Combat Slice 2 (spec 2026-09-04) — skill selection, resource
// gating, and AOE target collection for TurnBattleSystem.resolveNextStep().
// Kept in its own file (separate from TurnBattleSystem.ts) matching the
// existing ActionGauge.ts/TurnQueue.ts one-concern-per-file pattern.
import type { CombatEntity } from '../../combat/CombatEntity'
import type { SkillResourceType } from '../../skill/SkillTypes'
import type { ActionDamageInfo } from '../ActionImpactSystem'
import type { ActionTargeting } from '../CombatAction'

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
