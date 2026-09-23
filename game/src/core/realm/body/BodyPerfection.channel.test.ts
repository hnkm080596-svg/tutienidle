// M-F-BODY-PERFECTION (spec S5, plan Step 5.5) - the +10pp-per-realm
// multiplier inside the BODY-CORE base-stat channel: scaled deltas
// through collectEffectiveBodyBaseStatDeltas, raw contract preserved,
// multiplier isolation (no leak to non-body stat sources), and the
// assembled pipeline totals. Fixture registry via vi.mock (C2C r65-f1).
import { describe, expect, it, vi } from 'vitest'

const { FIXTURE } = vi.hoisted(() => {
  const FIXTURE: Record<string, readonly string[]> = {
  mortal: ['bp_mortal_a'],
  qi_refining: ['bp_qi_a'],
  foundation_establishment: [],
  golden_core: [],
  nascent_soul: [],
  soul_transformation: [],
  void_refinement: [],
  body_integration: [],
  mahayana: [],
  tribulation: [],
}
  return { FIXTURE }
})

vi.mock('../../../data/realm/BodyPerfection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/realm/BodyPerfection')>()

  const byRealm = new Map(Object.entries(FIXTURE).map(([realm, ids]) => [realm, ids]))
  const realmOf = new Map<string, string>()
  for (const [realm, ids] of byRealm) {
    for (const id of ids) {
      realmOf.set(id, realm)
    }
  }

  return {
    ...actual,
    BODY_PERFECTION_REALM_MATERIALS: FIXTURE,
    bodyPerfectionMaterialIds: (realmId: string) => byRealm.get(realmId),
    bodyPerfectionRealmOf: (materialId: string) => realmOf.get(materialId),
    isBodyPerfectionMaterial: (materialId: string) => realmOf.has(materialId),
  }
})

import { createDefaultPlayer, resolvePlayerStatAssembly } from '../../player/Player'
import {
  collectBodyBaseStatDeltas,
  collectEffectiveBodyBaseStatDeltas,
  statDeltaEntries,
} from './BodyProgressionSystem'
import { BODY_REFINEMENT_TIERS } from '../../../data/realm/BodyRefinement'
import type { StatModifier } from '../../stats/StatCalculator'

function playerWithBody(tiers: number, perfectedRealmIds: string[] = []) {
  const player = createDefaultPlayer()
  player.bodyProgression.body_refinement.completedTiers = tiers
  player.bodyPerfection.perfectedRealmIds = perfectedRealmIds
  return player
}

describe('collectEffectiveBodyBaseStatDeltas (plan 5.5)', () => {
  it('returns the raw contract unchanged when nothing is perfected', () => {
    const player = playerWithBody(3)

    expect(collectEffectiveBodyBaseStatDeltas(player))
      .toEqual(collectBodyBaseStatDeltas(player))
  })

  it('scales every body delta by 1 + 0.10 x perfectedCount', () => {
    const one = playerWithBody(3, ['mortal'])
    const two = playerWithBody(3, ['mortal', 'qi_refining'])

    const raw = collectBodyBaseStatDeltas(one)
    for (const [stat, delta] of statDeltaEntries(raw)) {
      const scaledOne = collectEffectiveBodyBaseStatDeltas(one)[stat]!
      const scaledTwo = collectEffectiveBodyBaseStatDeltas(two)[stat]!
      expect(scaledOne).toBeCloseTo(delta * 1.1)
      expect(scaledTwo).toBeCloseTo(delta * 1.2)
    }
  })

  it('never mutates the raw channel collector', () => {
    const player = playerWithBody(3, ['mortal', 'qi_refining'])
    const before = collectBodyBaseStatDeltas(player)

    collectEffectiveBodyBaseStatDeltas(player)

    expect(collectBodyBaseStatDeltas(player)).toEqual(before)
  })
})

describe('multiplier isolation (spec S5)', () => {
  it('non-body stat sources resolve byte-identical regardless of perfected count', () => {
    const bare = createDefaultPlayer()
    const perfected = createDefaultPlayer()
    perfected.bodyPerfection.perfectedRealmIds = ['mortal', 'qi_refining']

    // No body progression -> zero body deltas -> the multiplier must
    // change NOTHING else: baseStats, modifiers, externals.
    bare.baseStats.attunement = 7
    perfected.baseStats.attunement = 7
    bare.modifiers.push({ id: 'm', sourceId: 'm', sourceType: 'buff', stat: 'might', flat: 4 })
    perfected.modifiers.push({ id: 'm', sourceId: 'm', sourceType: 'buff', stat: 'might', flat: 4 })

    const external: StatModifier[] = [
      { id: 'e', sourceId: 'e', sourceType: 'equipment', stat: 'defense', flat: 9 },
    ]

    expect(resolvePlayerStatAssembly(bare, external).stats)
      .toEqual(resolvePlayerStatAssembly(perfected, external).stats)
  })

  it('assembled totals reflect the scaled body delta (spec S5 pipeline)', () => {
    // Luyen Bi grants a defense delta - the +10% scales the assembled
    // base contribution, not the percent layer.
    const unperfected = playerWithBody(1)
    const perfected = playerWithBody(1, ['mortal'])

    const delta = BODY_REFINEMENT_TIERS[0]!.baseGains.defense ?? 0
    const statsBare = resolvePlayerStatAssembly(unperfected, []).stats
    const statsBoosted = resolvePlayerStatAssembly(perfected, []).stats

    expect(statsBoosted.defense).toBeCloseTo(statsBare.defense + delta * 0.1)
    // Other stats untouched (the delta is defense-only on tier 0).
    expect(statsBoosted.might).toBeCloseTo(statsBare.might)
    expect(statsBoosted.vitality).toBeCloseTo(statsBare.vitality)
  })
})
