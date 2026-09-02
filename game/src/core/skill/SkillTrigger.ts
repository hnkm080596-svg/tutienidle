import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from './Skill'
import type { SkillAction } from './SkillAction'
import type { SkillResourcePoolKey } from './SkillAction'

// Trigger/Action rework (2026-08-31 spec, Phase 2A) — full vocabulary.
// onHit/onCrit/onEvade, onKill/onDeath, and onTick have real hand-wired
// firing sites (see the plan's Task 9/10/11). onProc/onResourceFull/
// onBreak fire from INSIDE the action executor that causes them (see
// SkillActionRegistry.ts's fireNested helper) — no separate firing site.
export type TriggerType =
  | 'onCast'
  | 'onHit'
  | 'onCrit'
  | 'onEvade'
  | 'onKill'
  | 'onDeath'
  | 'onTick'
  | 'onProc'
  | 'onBreak'
  | 'onResourceFull'

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

export interface OnKillContext {
  source: CombatEntity

  target: CombatEntity

  skill: Skill
}

export interface OnDeathContext {
  source: CombatEntity
}

export interface OnTickContext {
  source: CombatEntity

  target: CombatEntity

  skill: Skill

  tickIndex: number
}

export interface OnProcContext {
  source: CombatEntity

  target: CombatEntity

  skill: Skill

  buffId: string
}

export interface OnBreakContext {
  source: CombatEntity

  target: CombatEntity
}

export interface OnResourceFullContext {
  source: CombatEntity

  resource: SkillResourcePoolKey
}

export interface TriggerContextMap {
  onCast: OnCastContext

  onHit: OnHitContext

  onCrit: OnCritContext

  onEvade: OnEvadeContext

  onKill: OnKillContext

  onDeath: OnDeathContext

  onTick: OnTickContext

  onProc: OnProcContext

  onBreak: OnBreakContext

  onResourceFull: OnResourceFullContext
}

export interface TriggerBinding<T extends TriggerType = TriggerType> {
  trigger: T

  actions: SkillAction[]
}
