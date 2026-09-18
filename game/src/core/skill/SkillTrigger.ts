import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from './Skill'
import type { SkillAction } from './SkillAction'
import type { SkillResourcePoolKey } from './SkillAction'

// Trigger/Action rework (2026-08-31 spec, Phase 2A) — full vocabulary.
// Bindings are consumed by toTurnSkillDefinition (LegacySkillAdapter) into the live turn
// engine; the legacy nested-action firing site was deleted in Mission G.
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
