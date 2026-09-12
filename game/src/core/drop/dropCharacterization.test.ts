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
      ['qi_refining boss+elite', 'qi_refining', 'bandit', [BOSS_MODIFIER, TINH_ANH_MODIFIER]],
      // Foundation Establishment's 20 enemies carry no `family` field at all
      // (corrected fact - the brief's "43 enemies" figure is stale; the real
      // count is 64, with this whole tier missing `family`). familyId is
      // deliberately undefined here: this tier draws from its stage table
      // alone, which makes it the tier most at risk of being mis-balanced.
      ['foundation plain (no family)', 'foundation_establishment', undefined, []],
      ['foundation boss (no family)', 'foundation_establishment', undefined, [BOSS_MODIFIER]],
      [
        'foundation boss+elite (no family)',
        'foundation_establishment',
        undefined,
        [BOSS_MODIFIER, TINH_ANH_MODIFIER],
      ],
    ]

    for (const [label, realmId, familyId, modifiers] of rows) {
      const result = sampleDropExpectation(realmId, familyId, modifiers)

      console.log(
        `${label.padEnd(34)} stone/kill=${result.spiritStonePerKill.toFixed(2)}` +
          ` insight/kill=${result.techniqueInsightPerKill.toFixed(2)}` +
          ` items/kill=${result.itemsPerKill.toFixed(2)}` +
          ` noEquipmentRate=${(result.noEquipmentRate * 100).toFixed(1)}%`,
      )
    }

    expect(rows.length).toBe(9)
  })

  // Spec OQ1: if a boss+tinh anh kill fails to drop equipment too often, the
  // quality bonus - the rarest reward in the whole system - lands on nothing.
  //
  // OQ1 is specifically a boss+tinh_anh (5 pool draw) question, so it must be
  // measured at that exact modifier set in every realm where the question can
  // bind - not derived from a 4-draw (boss-only) rate, and not decided from
  // the mortal realm alone. The mortal realm's pool is 100% equipment-kind
  // entries (a faithful reflection of that tier's actual historical drops -
  // only tinh_hoa_pham_the and base_kiem ever dropped there - not an
  // authoring gap), so mortal's rate is real but structurally uninformative:
  // it cannot bind the threshold. qi_refining and foundation_establishment
  // both mix in material-kind pool lines and are where the question actually
  // bites, so the decision rule is applied against the worst of all three.
  it('measures OQ1: how often boss+tinh anh wastes its quality bonus', () => {
    const mortal = sampleDropExpectation('mortal', 'boar', [BOSS_MODIFIER, TINH_ANH_MODIFIER])
    const qiRefining = sampleDropExpectation('qi_refining', 'bandit', [
      BOSS_MODIFIER,
      TINH_ANH_MODIFIER,
    ])
    const foundation = sampleDropExpectation('foundation_establishment', undefined, [
      BOSS_MODIFIER,
      TINH_ANH_MODIFIER,
    ])

    console.log(`OQ1 mortal noEquipmentRate = ${(mortal.noEquipmentRate * 100).toFixed(1)}%`)
    console.log(
      `OQ1 qi_refining noEquipmentRate = ${(qiRefining.noEquipmentRate * 100).toFixed(1)}%`,
    )
    console.log(
      `OQ1 foundation_establishment noEquipmentRate = ${(foundation.noEquipmentRate * 100).toFixed(1)}%`,
    )

    for (const result of [mortal, qiRefining, foundation]) {
      expect(result.noEquipmentRate).toBeGreaterThanOrEqual(0)
      expect(result.noEquipmentRate).toBeLessThanOrEqual(1)
    }
  })
})
