import type { Stats } from '@/core/stats/StatBlock'

export interface CombatPowerTerm {
  readonly stat: keyof Stats
  readonly weight: number
}

// Suc Manh formula (owner: CombatPower, Ruling D6) - the same terms feed
// both the headline number and the hover breakdown rows.
export const COMBAT_POWER_TERMS: readonly CombatPowerTerm[] = [
  { stat: 'might', weight: 2 },
  { stat: 'defense', weight: 1.5 },
  { stat: 'maxHp', weight: 0.1 },
  { stat: 'maxMp', weight: 0.05 },
  { stat: 'criticalRate', weight: 500 },
  { stat: 'criticalDamage', weight: 300 },
  { stat: 'speed', weight: 200 },
]

export function computeCombatPowerTermContribution(
  stats: Stats,
  term: CombatPowerTerm,
): number {
  return Math.round(stats[term.stat] * term.weight)
}

export function computeCombatPower(stats: Stats): number {
  return Math.round(
    COMBAT_POWER_TERMS.reduce((sum, term) => sum + stats[term.stat] * term.weight, 0),
  )
}
