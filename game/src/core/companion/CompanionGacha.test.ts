import { describe, expect, it } from 'vitest'
import {
  COMPANION_BASE_RATES,
  DUPLICATE_MAXED_DUYEN_PHAN,
  effectiveCompanionRates,
  pickDefinitionOfGrade,
  pullCompanion,
  rollCompanionGrade,
} from './CompanionGacha'
import type { ItemGrade } from '@/core/item/ItemGrade'
import type { CompanionDefinition, CompanionInstance } from '@/data/companion/Companions'

function makeDefinition(id: string, grade: ItemGrade): CompanionDefinition {
  return {
    id,
    name: id.toUpperCase(),
    grade,
    growthRate: 0.05,
    unlockThresholds: {},
    baseStats: { maxHp: 100, might: 10, speed: 100 },
    basic: {
      id: `${id}_basic`,
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    },
  }
}

function makeInstance(overrides: Partial<CompanionInstance> = {}): CompanionInstance {
  return {
    instanceId: 'existing_instance',
    definitionId: 'a',
    realmId: 'mortal',
    realmLevel: 1,
    exp: 0,
    constellationRank: 0,
    ...overrides,
  }
}

// No tien definition: exercises the effective-rates filter on every pull.
const POOL: CompanionDefinition[] = [makeDefinition('a', 'hoang'), makeDefinition('b', 'tien')]

const POOL_NO_TIEN: CompanionDefinition[] = [
  makeDefinition('a', 'hoang'),
  makeDefinition('c', 'huyen'),
  makeDefinition('d', 'dia'),
  makeDefinition('e', 'thien'),
]

const FULL_POOL: CompanionDefinition[] = [...POOL_NO_TIEN, makeDefinition('b', 'tien')]

describe('rollCompanionGrade', () => {
  const rates: Record<ItemGrade, number> = { hoang: 0.5, huyen: 0.3, dia: 0.15, thien: 0.04, tien: 0.01 }

  it('random(0) rolls the first grade in the rate table', () => {
    expect(rollCompanionGrade(rates, () => 0)).toBe('hoang')
  })

  it('random(0.999) rolls the last grade', () => {
    expect(rollCompanionGrade(rates, () => 0.999)).toBe('tien')
  })
})

describe('pickDefinitionOfGrade', () => {
  it('picks only from definitions matching the rolled grade', () => {
    expect(pickDefinitionOfGrade('tien', POOL, () => 0).id).toBe('b')
  })

  it('throws if the pool has no definition of that grade (content gap, should never happen in real content)', () => {
    expect(() => pickDefinitionOfGrade('thien', POOL, () => 0)).toThrow()
  })
})

describe('effectiveCompanionRates', () => {
  it('zeroes grades with no definition in the pool and renormalizes the rest to sum 1', () => {
    const effective = effectiveCompanionRates(COMPANION_BASE_RATES, POOL_NO_TIEN)

    expect(effective.tien).toBe(0)
    expect(effective.hoang).toBeCloseTo(0.8399 / (1 - 0.0001), 10)

    const total = Object.values(effective).reduce((sum, rate) => sum + rate, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('a pull over a pool without tien never throws, even on a roll that would land in the tien slot', () => {
    // Unfiltered, random ~1 would roll tien and pickDefinitionOfGrade would
    // throw; filtered rates renormalize so the roll lands on thien instead.
    const { outcome } = pullCompanion([], POOL_NO_TIEN, 0, () => 0.99999)

    expect(outcome.grade).toBe('thien')
    expect(outcome.definition.id).toBe('e')
  })
})

describe('pullCompanion pity', () => {
  it('pull 29 (pullsSinceRare 28) does not arm pity; a natural dia still resets the counter', () => {
    // random 0.95 lands past hoang+huyen cumulative (0.9399...) on dia.
    const { pullsSinceRare, outcome } = pullCompanion([], POOL_NO_TIEN, 28, () => 0.95)

    expect(outcome.pityTriggered).toBe(false)
    expect(outcome.grade).toBe('dia')
    expect(pullsSinceRare).toBe(0)
  })

  it('pull 30 (pullsSinceRare 29) arms pity: grade is floored at dia and the counter resets', () => {
    const { pullsSinceRare, outcome } = pullCompanion([], FULL_POOL, 29, () => 0)

    expect(outcome.pityTriggered).toBe(true)
    expect(['dia', 'thien', 'tien']).toContain(outcome.grade)
    expect(pullsSinceRare).toBe(0)
  })

  it('armed pity can never roll hoang/huyen even on random ~1 (floor is dia)', () => {
    // Pool of hoang+dia only: elevated weights leave hoang at 0, so any
    // roll returns dia.
    const hoangDiaPool = [makeDefinition('a', 'hoang'), makeDefinition('d', 'dia')]

    for (const roll of [0, 0.5, 0.99999]) {
      const { outcome } = pullCompanion([], hoangDiaPool, 29, () => roll)
      expect(outcome.grade).toBe('dia')
      expect(outcome.pityTriggered).toBe(true)
    }
  })

  it('non-dia pulls keep counting', () => {
    const { pullsSinceRare, outcome } = pullCompanion([], POOL, 5, () => 0)

    expect(outcome.grade).toBe('hoang')
    expect(outcome.pityTriggered).toBe(false)
    expect(pullsSinceRare).toBe(6)
  })
})

describe('pullCompanion constellation duplicates', () => {
  it('new companion appends a fresh instance (mortal, realmLevel 1, rank 0)', () => {
    const { owned, outcome } = pullCompanion([], POOL, 0, () => 0, () => 'new_instance_id')

    expect(outcome.isDuplicate).toBe(false)
    expect(outcome.kind).toBe('new')
    expect(outcome.duyenPhanBonus).toBe(0)
    expect(owned).toEqual([
      {
        instanceId: 'new_instance_id',
        definitionId: 'a',
        realmId: 'mortal',
        realmLevel: 1,
        exp: 0,
        constellationRank: 0,
      },
    ])
  })

  it('duplicate raises constellationRank by 1 on the same instance (no second instance, no exp)', () => {
    const existing = makeInstance()
    const { owned, outcome } = pullCompanion([existing], POOL, 0, () => 0)

    expect(outcome.isDuplicate).toBe(true)
    expect(outcome.kind).toBe('constellation_up')
    expect(outcome.constellationRankAfter).toBe(1)
    expect(outcome.duyenPhanBonus).toBe(0)
    expect(owned).toHaveLength(1)
    expect(owned[0]!.instanceId).toBe('existing_instance')
    expect(owned[0]!.constellationRank).toBe(1)
    expect(owned[0]!.exp).toBe(0)
    // Input array and instance are not mutated.
    expect(existing.constellationRank).toBe(0)
  })

  it('duplicate at constellation rank 6 leaves the instance untouched and reports the duyenPhan bonus', () => {
    const existing = makeInstance({ constellationRank: 6 })
    const { owned, outcome } = pullCompanion([existing], POOL, 0, () => 0)

    expect(outcome.isDuplicate).toBe(true)
    expect(outcome.kind).toBe('constellation_maxed')
    expect(outcome.duyenPhanBonus).toBe(DUPLICATE_MAXED_DUYEN_PHAN)
    expect(owned).toHaveLength(1)
    expect(owned[0]).toBe(existing)
    expect(owned[0]!.constellationRank).toBe(6)
  })

  it('pulling the same definition thrice keeps owned at a single instance (1-1 invariant)', () => {
    let owned: CompanionInstance[] = []

    for (let i = 0; i < 3; i += 1) {
      owned = pullCompanion(owned, POOL, 0, () => 0, () => `id_${i}`).owned
    }

    expect(owned).toHaveLength(1)
    expect(owned[0]!.instanceId).toBe('id_0')
    expect(owned[0]!.constellationRank).toBe(2)
  })
})
