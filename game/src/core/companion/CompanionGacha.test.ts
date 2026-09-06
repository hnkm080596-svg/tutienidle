import { describe, expect, it } from 'vitest'
import { rollCompanionGrade, pickDefinitionOfGrade, pullCompanion } from './CompanionGacha'
import type { CompanionDefinition } from '@/data/companion/Companions'

const RATES = { hoang: 0.5, huyen: 0.3, dia: 0.15, thien: 0.04, tien: 0.01 }

const POOL: CompanionDefinition[] = [
  { id: 'a', name: 'A', grade: 'hoang', baseStats: { maxHp: 100, attack: 10, speed: 100 }, basic: { id: 'a_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } } },
  { id: 'b', name: 'B', grade: 'tien', baseStats: { maxHp: 100, attack: 10, speed: 100 }, basic: { id: 'b_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } } },
]

describe('rollCompanionGrade', () => {
  it('random(0) rolls the first grade in the rate table', () => {
    expect(rollCompanionGrade(RATES, () => 0)).toBe('hoang')
  })

  it('random(0.999) rolls the last grade', () => {
    expect(rollCompanionGrade(RATES, () => 0.999)).toBe('tien')
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

describe('pullCompanion — duplicate converts to exp instead of a second instance', () => {
  it('new companion: adds a fresh CompanionInstance at level 1', () => {
    const { owned, result } = pullCompanion([], RATES, POOL, () => 0)

    expect(result.isDuplicate).toBe(false)
    expect(owned).toEqual([{ definitionId: 'a', level: 1, exp: 0 }])
  })

  it('duplicate companion: grants exp to the existing instance, does not add a second one', () => {
    const existing = [{ definitionId: 'a', level: 1, exp: 0 }]

    const { owned, result } = pullCompanion(existing, RATES, POOL, () => 0)

    expect(result.isDuplicate).toBe(true)
    expect(owned).toHaveLength(1)
    expect(owned[0]!.exp).toBeGreaterThan(0)
  })
})
