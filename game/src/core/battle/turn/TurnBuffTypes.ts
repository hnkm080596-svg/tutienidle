import type { StatType } from '../../stats/StatTypes'
import type { ElementType } from '../../element/ElementType'

export type TurnBuffPolarity = 'buff' | 'debuff'

export type TurnBuffStackMode = 'stack' | 'refresh' | 'replace'

export type TurnBuffCcEffect = 'stun' | 'freeze' | 'root'

// --- Template-time shapes (TurnBuffDefinition.effects) ---

export interface TurnStatModifierEffect {
  type: 'statModifier'
  stat: StatType
  percent?: number
  flat?: number
}

export interface TurnDotEffectTemplate {
  type: 'dot'
  dpsRatio: number
  element?: ElementType | 'physical'
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
  armorIgnorePercentByRealm?: boolean
}

export interface TurnCcEffect {
  type: 'cc'
  ccEffect: TurnBuffCcEffect
}

export interface TurnOnHitProcEffect {
  type: 'onHitProc'
  chance: number
  appliesBuffId: string
}

/**
 * Future Systems Task 6 (2026-09-04) — haste/slow đẩy TRỰC TIẾP ATB: bắn
 * 1 LẦN tức thì lúc buff được áp (khác statModifier trên speed — hiệu ứng
 * liên tục), cộng/trừ % GAUGE_MAX vào actionGauge qua refundGauge() có
 * sẵn (đã clamp [0, GAUGE_MAX]).
 */
export interface TurnGaugeDeltaEffect {
  type: 'gaugeDelta'
  percentOfMax: number
}

export type TurnBuffEffectTemplate =
  | TurnStatModifierEffect
  | TurnDotEffectTemplate
  | TurnCcEffect
  | TurnOnHitProcEffect
  | TurnGaugeDeltaEffect

// --- Runtime shapes (TurnBuff.effects) ---

export interface TurnDotEffect {
  type: 'dot'
  damagePerTurn: number
  element?: ElementType | 'physical'
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
}

export type TurnBuffEffect = TurnStatModifierEffect | TurnDotEffect | TurnCcEffect | TurnOnHitProcEffect | TurnGaugeDeltaEffect

export interface TurnBuffDefinition {
  id: string
  name: string
  description?: string
  polarity: TurnBuffPolarity
  hidden?: boolean

  duration: number
  maxStacks?: number
  stackMode: TurnBuffStackMode

  convertsToId?: string
  convertsAfterContinuousTurns?: number

  effects: TurnBuffEffectTemplate[]
}

export interface TurnBuff {
  id: string
  sourceId: string
  targetId: string
  polarity: TurnBuffPolarity
  hidden?: boolean

  duration: number
  remainingTurns: number
  stacks: number
  maxStacks?: number
  stackMode: TurnBuffStackMode

  continuousTurns: number
  convertsToId?: string
  convertsAfterContinuousTurns?: number

  effects: TurnBuffEffect[]
}

export interface TurnBuffRegistry {
  get(id: string): TurnBuffDefinition
}
