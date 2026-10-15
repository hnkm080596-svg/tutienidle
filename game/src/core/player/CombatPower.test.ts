import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, resolvePlayerFinalStats } from './Player'
import {
  COMBAT_POWER_TERMS,
  computeCombatPower,
  computeCombatPowerTermContribution,
} from './CombatPower'

describe('CombatPower (Ruling D6)', () => {
  it('computes combat power using the exact weighted sum over finalStats', () => {
    const player = createDefaultPlayer()
    const stats = resolvePlayerFinalStats(player, [])

    const expected = Math.round(
      stats.might * 2 +
        stats.defense * 1.5 +
        stats.maxHp * 0.1 +
        stats.maxMp * 0.05 +
        stats.criticalRate * 500 +
        stats.criticalDamage * 300 +
        stats.speed * 200,
    )

    expect(computeCombatPower(stats)).toBe(expected)
  })

  it('computes individual term contributions matching the breakdown table', () => {
    const player = createDefaultPlayer()
    const stats = resolvePlayerFinalStats(player, [])

    for (const term of COMBAT_POWER_TERMS) {
      expect(computeCombatPowerTermContribution(stats, term)).toBe(
        Math.round(stats[term.stat] * term.weight),
      )
    }
  })
})
