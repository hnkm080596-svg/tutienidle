import { describe, expect, it } from 'vitest'
import { companionStatsAtLevel, companionToCombatEntity } from './CompanionCombat'
import type { CompanionDefinition, CompanionInstance } from '@/data/companion/Companions'

const TEST_DEFINITION: CompanionDefinition = {
  id: 'test_companion',
  name: 'Test Companion',
  grade: 'hoang',
  baseStats: { maxHp: 100, attack: 10, speed: 100 },
  basic: { id: 'test_companion_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
}

describe('companionStatsAtLevel', () => {
  it('level 1 returns base stats unchanged', () => {
    expect(companionStatsAtLevel(TEST_DEFINITION.baseStats, 1)).toEqual(TEST_DEFINITION.baseStats)
  })

  it('higher level scales stats upward', () => {
    const level10 = companionStatsAtLevel(TEST_DEFINITION.baseStats, 10)

    expect(level10.maxHp).toBeGreaterThan(TEST_DEFINITION.baseStats.maxHp)
    expect(level10.attack).toBeGreaterThan(TEST_DEFINITION.baseStats.attack)
  })
})

describe('companionToCombatEntity', () => {
  it('builds a fresh, alive CombatEntity with the definition id and full HP', () => {
    const instance: CompanionInstance = { definitionId: 'test_companion', level: 1, exp: 0 }

    const entity = companionToCombatEntity(instance, TEST_DEFINITION)

    expect(entity.id).toBe('test_companion')
    expect(entity.alive).toBe(true)
    expect(entity.currentHp).toBe(entity.maxHp)
    expect(entity.stats.attack).toBe(TEST_DEFINITION.baseStats.attack)
  })
})
