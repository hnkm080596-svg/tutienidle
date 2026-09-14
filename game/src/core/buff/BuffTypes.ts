import type { StatType } from '../stats/StatTypes'
import type { StatDomain } from '../stats/StatDomain'
import type { ElementType } from '../element/ElementType'

// R4 (AR-19) — Canonical Buff & Status Types.
// Consolidates turn-based and persistent buff shapes under one authority.

export type BuffPolarity = 'buff' | 'debuff'

export type BuffStackMode = 'stack' | 'refresh' | 'replace'

export type BuffCcEffect = 'stun' | 'freeze' | 'root'

// --- Template-time shapes (BuffDefinition.effects) ---

export interface StatModifierEffect {
  type: 'statModifier'
  stat: StatType
  percent?: number
  flat?: number
  // stat-system-reimagined Task 3 — forwarded onto the emitted
  // StatModifier so a buff targeting a domain-gated stat (e.g. MP pool
  // stats gated to 'phap_tu' once STAT_DOMAIN activates in Task 7)
  // declares its credential at authoring time.
  domain?: StatDomain
}

export interface DotEffectTemplate {
  type: 'dot'
  dpsRatio: number
  element?: ElementType | 'physical'
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
  armorIgnorePercentByRealm?: boolean
}

export interface CcEffect {
  type: 'cc'
  ccEffect: BuffCcEffect
}

export interface OnHitProcEffect {
  type: 'onHitProc'
  chance: number
  appliesBuffId: string
}

export interface ReactiveTriggerEffect {
  type: 'reactiveTrigger'
  trigger: 'onCastBegin' | 'onImpactLanded'
  chance: number
  appliesDefinitionId?: string
  queuesFollowUp?: boolean
}

export interface GaugeDeltaEffect {
  type: 'gaugeDelta'
  percentOfMax: number
}

export type BuffEffectTemplate =
  | StatModifierEffect
  | DotEffectTemplate
  | CcEffect
  | OnHitProcEffect
  | GaugeDeltaEffect
  | ReactiveTriggerEffect

// --- Runtime shapes (Buff.effects) ---

export interface DotEffect {
  type: 'dot'
  damagePerTurn?: number
  damagePerSecond?: number
  element?: ElementType | 'physical'
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
}

export type BuffEffect =
  | StatModifierEffect
  | DotEffect
  | CcEffect
  | OnHitProcEffect
  | GaugeDeltaEffect
  | ReactiveTriggerEffect

export interface BuffDefinition {
  id: string
  name: string
  description?: string
  polarity: BuffPolarity
  hidden?: boolean

  duration: number
  maxStacks?: number
  stackMode: BuffStackMode

  convertsToId?: string
  convertsAfterContinuousTurns?: number
  convertsAfterContinuousSeconds?: number

  effects: BuffEffectTemplate[]
}

export interface Buff {
  id: string
  sourceId: string
  targetId: string
  polarity: BuffPolarity
  hidden?: boolean

  duration: number
  remainingTurns: number
  remainingTime?: number
  stacks: number
  maxStacks?: number
  stackMode: BuffStackMode

  continuousTurns?: number
  continuousSeconds?: number
  convertsToId?: string
  convertsAfterContinuousTurns?: number
  convertsAfterContinuousSeconds?: number

  effects: BuffEffect[]
}

export interface BuffDefinitionCatalog {
  get(id: string): BuffDefinition
}
