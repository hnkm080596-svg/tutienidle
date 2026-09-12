import { describe, expect, it } from 'vitest'
import { BOSS_MODIFIER, TINH_ANH_MODIFIER, type DropModifier } from './DropModifier'
import { sampleDropExpectation } from './dropSampling'

describe('drop characterization - the numbers this design is judged on', () => {
  it('prints the expectation table', () => {
    const rows: Array<[string, string, string | undefined, DropModifier[]]> = [
      ['mortal plain', 'mortal', 'boar', []],
      ['mortal elite', 'mortal', 'boar', [TINH_ANH_MODIFIER]],
      ['mortal boss', 'mortal', 'boar', [BOSS_MODIFIER]],
      ['mortal boss+elite', 'mortal', 'boar', [BOSS_MODIFIER, TINH_ANH_MODIFIER]],
      ['qi_refining boss', 'qi_refining', 'bandit', [BOSS_MODIFIER]],
      // Foundation Establishment's 20 enemies carry no `family` field at all
      // (corrected fact - the brief's "43 enemies" figure is stale; the real
      // count is 64, with this whole tier missing `family`). familyId is
      // deliberately undefined here: this tier draws from its stage table
      // alone, which makes it the tier most at risk of being mis-balanced.
      ['foundation plain (no family)', 'foundation_establishment', undefined, []],
      ['foundation boss (no family)', 'foundation_establishment', undefined, [BOSS_MODIFIER]],
    ]

    for (const [label, realmId, familyId, modifiers] of rows) {
      const result = sampleDropExpectation(realmId, familyId, modifiers)

      console.log(
        `${label.padEnd(32)} stone/kill=${result.spiritStonePerKill.toFixed(2)}` +
          ` insight/kill=${result.techniqueInsightPerKill.toFixed(2)}` +
          ` items/kill=${result.itemsPerKill.toFixed(2)}` +
          ` noEquipmentRate=${(result.noEquipmentRate * 100).toFixed(1)}%`,
      )
    }

    expect(rows.length).toBe(7)
  })

  // Spec OQ1: if a boss+tinh anh kill fails to drop equipment too often, the
  // quality bonus - the rarest reward in the whole system - lands on nothing.
  it('measures OQ1: how often boss+tinh anh wastes its quality bonus', () => {
    const result = sampleDropExpectation('mortal', 'boar', [BOSS_MODIFIER, TINH_ANH_MODIFIER])

    console.log(`OQ1 noEquipmentRate = ${(result.noEquipmentRate * 100).toFixed(1)}%`)

    expect(result.noEquipmentRate).toBeGreaterThanOrEqual(0)
    expect(result.noEquipmentRate).toBeLessThanOrEqual(1)
  })
})
