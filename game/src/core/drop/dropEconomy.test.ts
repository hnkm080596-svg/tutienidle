import { describe, expect, it } from 'vitest'
import { BOSS_MODIFIER, TINH_ANH_MODIFIER } from './DropModifier'
import { sampleDropExpectation } from './dropSampling'

/**
 * Expected spirit stone per kill, per form on the mortal band.
 *
 * These are NAMED CONSTANTS, not bare numbers: changing one is a visible
 * decision in review rather than a value that drifted. Values measured at
 * Task 6 (100k samples, seeded rng): plain 1.50, elite 3.00, boss 4.50,
 * stacked 6.00.
 */
const EXPECTED_SPIRIT_STONE_PER_KILL = {
  mortalPlain: 1.5,
  mortalElite: 3.0,
  mortalBoss: 4.5,
  mortalStacked: 6.0,
}

const TOLERANCE = 0.05

function expectWithin(actual: number, expected: number, label: string) {
  expect(
    Math.abs(actual - expected) / expected,
    `${label}: ${actual} vs ${expected}`,
  ).toBeLessThanOrEqual(TOLERANCE)
}

describe('drop economy (spec §5.3)', () => {
  it('holds the currency expectation per form', () => {
    expectWithin(
      sampleDropExpectation('mortal', 'boar', []).spiritStonePerKill,
      EXPECTED_SPIRIT_STONE_PER_KILL.mortalPlain,
      'mortal plain',
    )

    expectWithin(
      sampleDropExpectation('mortal', 'boar', [TINH_ANH_MODIFIER]).spiritStonePerKill,
      EXPECTED_SPIRIT_STONE_PER_KILL.mortalElite,
      'mortal elite',
    )

    expectWithin(
      sampleDropExpectation('mortal', 'boar', [BOSS_MODIFIER]).spiritStonePerKill,
      EXPECTED_SPIRIT_STONE_PER_KILL.mortalBoss,
      'mortal boss',
    )

    expectWithin(
      sampleDropExpectation('mortal', 'boar', [BOSS_MODIFIER, TINH_ANH_MODIFIER]).spiritStonePerKill,
      EXPECTED_SPIRIT_STONE_PER_KILL.mortalStacked,
      'mortal stacked',
    )
  })

  it('keeps the ceiling: a stacked kill is at most four times a plain one', () => {
    const plain = sampleDropExpectation('mortal', 'boar', []).spiritStonePerKill
    const stacked = sampleDropExpectation('mortal', 'boar', [
      BOSS_MODIFIER,
      TINH_ANH_MODIFIER,
    ]).spiritStonePerKill

    expect(stacked / plain).toBeLessThanOrEqual(4 * (1 + TOLERANCE))
  })
})
