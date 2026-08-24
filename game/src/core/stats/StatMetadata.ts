import type { StatType } from './StatTypes'

export type StatUnit = 'flat' | 'percent' | 'rating' | 'multiplier'

export interface StatMetadata {
  unit: StatUnit
  min?: number
  max?: number
}

// Nguồn chuẩn cho đơn vị và giới hạn semantic. Những stat không khai ở
// đây là số flat không có trần cứng ở tầng dữ liệu.
export const STAT_METADATA: Partial<Record<StatType, StatMetadata>> = {
  accuracyRating: { unit: 'rating', min: 0 },
  evasionRate: { unit: 'rating', min: 0 },
  criticalRate: { unit: 'percent', min: 0, max: 1 },
  criticalDamage: { unit: 'multiplier', min: 1 },
  criticalAvoidance: { unit: 'percent', min: 0, max: 1 },
  blockChance: { unit: 'percent', min: 0, max: 0.75 },
  blockEffectiveness: { unit: 'percent', min: 0, max: 0.75 },
  endurancePercent: { unit: 'percent', min: 0, max: 0.75 },
  manaShieldPercent: { unit: 'percent', min: 0, max: 0.8 },
  leechPercent: { unit: 'percent', min: 0, max: 0.25 },
  cooldownReduction: { unit: 'percent', min: 0, max: 3 },
  castSpeedPercent: { unit: 'percent', min: 0, max: 3 },
  finalDamagePercent: { unit: 'percent', min: -1 },
  finalDamageReductionPercent: { unit: 'percent', min: 0, max: 0.75 },
  chanceToIgnoreResistance: { unit: 'percent', min: 0, max: 1 },
  ailmentResistPercent: { unit: 'percent', min: 0, max: 0.75 },
  ailmentPotencyPercent: { unit: 'percent', min: 0 },
  skillDamagePercent: { unit: 'percent', min: 0 },
  elementApplicationPercent: { unit: 'percent', min: 0, max: 1 },
  reactionEffectPercent: { unit: 'percent', min: 0 },
  ailmentDurationPercent: { unit: 'percent', min: 0 },
  dotResistancePercent: { unit: 'percent', min: -1, max: 0.75 },
  poisonRecoveryPercent: { unit: 'percent', min: 0 },
  wardBreakDamagePercent: { unit: 'percent', min: 0 },
  thornsPercent: { unit: 'percent', min: 0 },
}

export function clampStatValue(stat: StatType, value: number): number {
  const metadata = STAT_METADATA[stat]
  if (!metadata) return value

  const aboveMin = metadata.min === undefined ? value : Math.max(metadata.min, value)
  return metadata.max === undefined ? aboveMin : Math.min(metadata.max, aboveMin)
}

export function isPercentStat(stat: StatType): boolean {
  return STAT_METADATA[stat]?.unit === 'percent'
}
