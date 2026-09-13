import { describe, expect, it } from 'vitest'
import { companionToCombatEntity } from './CompanionCombat'
import { getRealmIndex } from '@/core/realm/realmSystem'
import type { CompanionDefinition, CompanionInstance } from '@/data/companion/Companions'

const TEST_DEFINITION: CompanionDefinition = {
  id: 'test_companion',
  name: 'Test Companion',
  grade: 'hoang',
  growthRate: 0.05,
  unlockThresholds: {},
  baseStats: { maxHp: 100, attack: 10, speed: 100 },
  basic: { id: 'test_companion_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
}

// Same base numbers + one 'stat' perk so constellation multiplier and perk
// application can be told apart in the assertions below.
const PERKED_DEFINITION: CompanionDefinition = {
  ...TEST_DEFINITION,
  id: 'test_companion_perked',
  constellationPerks: [{ atRank: 1, kind: 'stat', stat: 'attack', percent: 50 }],
}

function makeInstance(overrides: Partial<CompanionInstance> = {}): CompanionInstance {
  return {
    instanceId: 'test_instance',
    definitionId: TEST_DEFINITION.id,
    realmId: 'mortal',
    realmLevel: 1,
    exp: 0,
    constellationRank: 0,
    ...overrides,
  }
}

describe('companionToCombatEntity', () => {
  it('builds a fresh, alive CombatEntity with the definition id and full HP', () => {
    const entity = companionToCombatEntity(makeInstance(), TEST_DEFINITION)

    expect(entity.id).toBe('test_companion')
    expect(entity.alive).toBe(true)
    expect(entity.currentHp).toBe(entity.maxHp)
    expect(entity.stats.attack).toBe(TEST_DEFINITION.baseStats.attack)
  })

  it('sets realmIndex from getRealmIndex(instance.realmId)', () => {
    const mortal = companionToCombatEntity(makeInstance({ realmId: 'mortal' }), TEST_DEFINITION)
    const qiRefining = companionToCombatEntity(makeInstance({ realmId: 'qi_refining' }), TEST_DEFINITION)

    expect(mortal.realmIndex).toBe(getRealmIndex('mortal'))
    expect(qiRefining.realmIndex).toBe(getRealmIndex('qi_refining'))
    expect(qiRefining.realmIndex).toBe(1)
  })

  it('scales stats via companionStatsAt: realm-level growth + constellation multiplier', () => {
    // mortal/5 -> globalLevel 5 -> growth = 1 + 0.05 * 4 = 1.2 (speed ignores growth).
    const leveled = companionToCombatEntity(makeInstance({ realmLevel: 5 }), TEST_DEFINITION)

    expect(leveled.stats.attack).toBe(12)
    expect(leveled.stats.maxHp).toBe(120)
    expect(leveled.stats.speed).toBe(100)

    // rank 2 at level 1 -> growth 1, constellation x1.2 on all three stats.
    // speed is not Math.round'ed by companionStatsAt - compare approximately.
    const ranked = companionToCombatEntity(makeInstance({ constellationRank: 2 }), TEST_DEFINITION)

    expect(ranked.stats.attack).toBe(12)
    expect(ranked.stats.maxHp).toBe(120)
    expect(ranked.stats.speed).toBeCloseTo(120)
  })

  it('applies constellation stat perks on top of the multiplier', () => {
    // rank 2: attack = 10 * 1.2 (constellation) then perk percent +50 -> 18.
    const ranked = companionToCombatEntity(makeInstance({ constellationRank: 2 }), PERKED_DEFINITION)

    expect(ranked.stats.attack).toBe(18)

    // rank 0: perk atRank 1 not met, no constellation bonus either.
    const unranked = companionToCombatEntity(makeInstance(), PERKED_DEFINITION)

    expect(unranked.stats.attack).toBe(10)
  })
})
