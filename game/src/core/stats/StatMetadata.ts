import type { StatType } from './StatTypes'
import { REACTIVE_CHANCE_CAP } from './TheTuStatChannels'

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
  linhLucHoTheCap: { unit: 'percent', min: 0, max: 0.75 },
  leechPercent: { unit: 'percent', min: 0, max: 0.25 },
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
  wardBreakDamagePercent: { unit: 'percent', min: 0 },
  // generic thorns stat retired (spec 2026-09-15 T12).
  healingEffectivenessPercent: { unit: 'percent', min: 0 },
  // The Tu An reactive chances — hard cap REACTIVE_CHANCE_CAP applied
  // ONLY at consumption (clampStatValue). Stored values may exceed it;
  // never clamp inside an emitter/deriver (StatCalculator.body.test).
  counterChance: { unit: 'percent', min: 0, max: REACTIVE_CHANCE_CAP },
  protectChance: { unit: 'percent', min: 0, max: REACTIVE_CHANCE_CAP },
  followUpChance: { unit: 'percent', min: 0, max: REACTIVE_CHANCE_CAP },

  // Realm passive stat modifier % (useRealmStatPassives).
  realmPassivePercent: { unit: 'percent' },
  // Equipment enhancement delta (affix upgrade % growth).
  affixDeltaPercent: { unit: 'percent' },
  // Multipliers (production speed, artifact grade).
  productionSpeedMultiplier: { unit: 'multiplier', min: 0 },
  artifactGradeMultiplier: { unit: 'multiplier', min: 0 },
  // Pill cultivation % (relative to realm tier requirement).
  cultivationPercent: { unit: 'percent' },
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
