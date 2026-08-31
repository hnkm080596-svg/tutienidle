import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from './Skill'
import type { SkillAction } from './SkillAction'

// Trigger/Action rework (2026-08-31 spec) — only 'onCast' has a production
// firing site in this phase (BattleSystem.resolveSkillEffects). 'onHit'/
// 'onCrit'/'onEvade' are declared now (SkillTriggerRunner is already
// generic over TriggerType) so a later plan can wire their firing site
// with zero changes here — adding a NEW trigger member later still only
// costs one type-union entry + one context interface + one firing call.
export type TriggerType = 'onCast' | 'onHit' | 'onCrit' | 'onEvade'

export interface OnCastContext {
  source: CombatEntity

  skill: Skill
}

export interface OnHitContext {
  source: CombatEntity

  target: CombatEntity

  skill: Skill

  damageDealt: number

  isCrit: boolean
}

export type OnCritContext = OnHitContext

export interface OnEvadeContext {
  source: CombatEntity

  target: CombatEntity

  skill: Skill
}

export interface TriggerContextMap {
  onCast: OnCastContext

  onHit: OnHitContext

  onCrit: OnCritContext

  onEvade: OnEvadeContext
}

export interface TriggerBinding<T extends TriggerType = TriggerType> {
  trigger: T

  actions: SkillAction[]
}
