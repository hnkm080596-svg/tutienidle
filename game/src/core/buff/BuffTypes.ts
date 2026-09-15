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

// stat-system-reimagined Task 4 (D18) -- authored DoT-recovery trigger on
// the SOURCE's own buff (Doc Can). When a DoT tick of a matching element
// lands, the living source heals healPercent * stacks of the damage dealt;
// the heal then scales with the source's healingEffectivenessPercent.
// Element omitted = recovers from any DoT element.
export interface DotRecoveryEffect {
  type: 'dotRecovery'
  element?: ElementType | 'physical'
  healPercent: number
}

export type BuffEffectTemplate =
  | StatModifierEffect
  | DotEffectTemplate
  | CcEffect
  | OnHitProcEffect
  | GaugeDeltaEffect
  | ReactiveTriggerEffect
  | DotRecoveryEffect

// --- Runtime shapes (Buff.effects) ---

export interface DotEffect {
  type: 'dot'
  damagePerTurn?: number
  damagePerSecond?: number
  element?: ElementType | 'physical'
}

export type BuffEffect =
  | StatModifierEffect
  | DotEffect
  | CcEffect
  | OnHitProcEffect
  | GaugeDeltaEffect
  | ReactiveTriggerEffect
  | DotRecoveryEffect

export interface BuffDefinition {
  id: string
  name: string
  description?: string
  polarity: BuffPolarity
  hidden?: boolean

  // Phap Tu Reimagined Task 5 — the ELEMENT this ailment belongs to
  // (definition-level identity for the Sinh/Khac reaction engine).
  // Distinct from the per-effect `element` fields inside effects (those
  // describe a DoT's damage type). Untagged = non-elemental buff.
  element?: ElementType

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

  /**
   * Runtime marker — this instance already consumed its one amplification
   * (Cong Minh). refresh/stack modes keep the same Buff instance, so
   * without the flag each repeat event would re-scale already-amplified
   * effects into exponential compounding. Set by scaleBuffPotency; a
   * fresh instance (replace/expire) starts unamplified.
   */
  potencyAmplified?: boolean

  effects: BuffEffect[]
}

export interface BuffDefinitionCatalog {
  get(id: string): BuffDefinition
}
