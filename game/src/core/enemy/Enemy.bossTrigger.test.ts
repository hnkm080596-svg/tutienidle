import { describe, expect, it } from 'vitest'
import { defineEnemy, enemyToCombatEntity } from './Enemy'

describe('Enemy bossTrigger config threading', () => {
  it('carries bossTrigger from EnemyDefinition through defineEnemy() to Enemy', () => {
    const enemy = defineEnemy({
      id: 'fixture_boss',
      name: 'Fixture Boss',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 100,
        attack: 10,
        attackSpeed: 1,
        attackRangeRanks: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
        evasionRate: 0,
      },
      rewards: { techniqueInsight: 1, spiritStone: 1 },
      bossTrigger: { afterTurns: 60, buffDefinitionId: 'fixture_enrage' },
    })

    expect(enemy.bossTrigger).toEqual({ afterTurns: 60, buffDefinitionId: 'fixture_enrage' })
  })

  it('carries bossTrigger from Enemy through enemyToCombatEntity() to CombatEntity', () => {
    const enemy = defineEnemy({
      id: 'fixture_boss',
      name: 'Fixture Boss',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 100,
        attack: 10,
        attackSpeed: 1,
        attackRangeRanks: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
        evasionRate: 0,
      },
      rewards: { techniqueInsight: 1, spiritStone: 1 },
      bossTrigger: { afterTurns: 60, buffDefinitionId: 'fixture_enrage' },
    })

    const entity = enemyToCombatEntity(enemy)

    expect(entity.bossTrigger).toEqual({ afterTurns: 60, buffDefinitionId: 'fixture_enrage' })
  })

  it('leaves bossTrigger undefined for ordinary enemies', () => {
    const enemy = defineEnemy({
      id: 'fixture_mob',
      name: 'Fixture Mob',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 50,
        attack: 5,
        attackSpeed: 1,
        attackRangeRanks: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
        evasionRate: 0,
      },
      rewards: { techniqueInsight: 1, spiritStone: 1 },
    })

    expect(enemy.bossTrigger).toBeUndefined()
    expect(enemyToCombatEntity(enemy).bossTrigger).toBeUndefined()
  })
})
