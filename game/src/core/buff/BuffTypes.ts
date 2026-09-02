import type { StatType } from '../stats/StatTypes'
import type { ElementType } from '../element/ElementType'

export type BuffPolarity = 'buff' | 'debuff'

export type BuffStackMode = 'stack' | 'refresh' | 'replace'

export type BuffCcEffect = 'stun' | 'freeze' | 'root'

// --- Template-time shapes (BuffDefinition.effects) ---

export interface StatModifierEffect {
  type: 'statModifier'
  stat: StatType
  percent?: number
  flat?: number
}

export interface DotEffectTemplate {
  type: 'dot'
  // Ratio against source Power (ATK or elemental Power depending on
  // `element`) — resolved into a snapshotted `damagePerSecond` number by
  // BuffSystem.apply(), exactly like AilmentTemplate.dpsRatio did.
  dpsRatio: number
  element?: ElementType | 'physical'
  // Mộc Tu "Độc Căn" DoT scaling — ported verbatim from
  // AilmentTemplate.poisonRootPercentPerStack/poisonRootMaxStacks/
  // poisonRootThresholdBonusPercent (static, not resolved — copied as-is
  // onto the runtime effect).
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
  // Kiếm Tu (Vạn Kiếm Triều Tông) — "bỏ qua 10%-90% giáp/kháng theo cảnh
  // giới" — ported verbatim from AilmentTemplate.armorIgnorePercentByRealm
  // (AilmentRegistry.ts). Apply-time-only, consumed once inside
  // BuffSystem.calculateDamagePerSecond() (same as `dpsRatio` itself) — does
  // NOT survive onto the resolved runtime DotEffect.
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

export type BuffEffectTemplate = StatModifierEffect | DotEffectTemplate | CcEffect | OnHitProcEffect

// --- Runtime shapes (Buff.effects) ---

export interface DotEffect {
  type: 'dot'
  // Resolved once at apply time (source.stats snapshot) — see
  // BuffSystem.apply(). NOT re-read from source every tick.
  damagePerSecond: number
  element?: ElementType | 'physical'
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
}

export type BuffEffect = StatModifierEffect | DotEffect | CcEffect | OnHitProcEffect
