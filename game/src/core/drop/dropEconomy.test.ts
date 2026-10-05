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

  // Minh ruling 2026-10-05: mortal equipment lands on ~15% of kills, not
  // every kill. The stage band gates each pool draw at 0.15 (see
  // StageDropTables.poolDrawChance), so a plain mortal kill - one draw -
  // mints no equipment 85% of the time. The pin holds across family
  // composition because the miss weight is computed on the merged bag.
  it('mortal kills mint equipment only ~15% of the time', () => {
    const plain = sampleDropExpectation('mortal', 'boar', [])
    const familyless = sampleDropExpectation('mortal', undefined, [])

    expect(plain.noEquipmentRate).toBeGreaterThanOrEqual(0.83)
    expect(plain.noEquipmentRate).toBeLessThanOrEqual(0.87)
    expect(familyless.noEquipmentRate).toBeGreaterThanOrEqual(0.83)
    expect(familyless.noEquipmentRate).toBeLessThanOrEqual(0.87)
  })

  it('higher bands are unaffected by the mortal gate', () => {
    // Ungated tables keep their pre-change rates: qi_refining bandit
    // merged bag is ore 30 + equipment_any 20 + base_hai 10 + base_truy
    // 10 (equipment 40/70 -> noEquipment ~43%); foundation's stage-only
    // bag is 25+15+20 (equipment 20/60 -> noEquipment ~67%).
    const qiRefining = sampleDropExpectation('qi_refining', 'bandit', [])
    const foundation = sampleDropExpectation('foundation_establishment', undefined, [])

    expect(qiRefining.itemsPerKill).toBeGreaterThanOrEqual(1)
    expect(foundation.itemsPerKill).toBeGreaterThanOrEqual(1)
    expect(qiRefining.noEquipmentRate).toBeGreaterThanOrEqual(0.40)
    expect(qiRefining.noEquipmentRate).toBeLessThanOrEqual(0.46)
    expect(foundation.noEquipmentRate).toBeGreaterThanOrEqual(0.64)
    expect(foundation.noEquipmentRate).toBeLessThanOrEqual(0.70)
  })
})
