import type { SkillDamageComponent } from './SkillDamageComponent'
import type { StatType } from '../stats/StatTypes'

// Trigger/Action rework (2026-08-31 spec) — replaces the old per-mechanic
// fields on SkillEffect (attributeScaling, swordIntentDamageRatio,
// realmDamageRatio, manaScalingRatio, skillExperienceRatio,
// hitCountByRealm) with one composable action. New action types (heal,
// applyBuff, applyAilment, grantResource, consumeForDamage, spawnZone,
// spawnVfx, ...) get added here + registered in SkillActionRegistry.ts as
// each future path migration needs them — do not add unused ones ahead of
// need.
export interface DealDamageAction {
  type: 'dealDamage'

  value?: number

  damageType?: 'physical' | 'primordial'

  components?: SkillDamageComponent[]

  attributeScaling?: { attributes: StatType[]; ratioPerPoint: number }[]

  swordIntentDamageRatio?: number

  realmDamageRatio?: number

  manaScalingRatio?: number

  skillExperienceRatio?: number

  hitCountByRealm?: boolean
}

export type SkillAction = DealDamageAction

export type SkillActionType = SkillAction['type']

/**
 * Scratch state shared by every action inside one TriggerBinding's action
 * list, seeded from the firing trigger's context. Lets a later action read
 * a value an earlier action produced (e.g. a future `consumeForDamage`
 * writing `consumedDamage` for a following `heal` to read) without either
 * action knowing the other by name.
 */
export interface ActionRuntimeContext {
  damageDealt?: number

  isCrit?: boolean

  consumedDamage?: number
}
