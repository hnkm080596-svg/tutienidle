// Pin tests (design 2026-09-23 sec.9.4 - HIDDEN-B): an `undefeatable`
// entity can never be declared dead by any damage path. The semantic-
// immortal flag clamps HP to 1 and emits the survive_lethal correction
// feed instead of running the death block; ordinary entities die as
// before. Fixture shape mirrors CombatSystem.surviveLethal.test.ts.
import { describe, expect, it } from 'vitest'
import { EventBus } from '../events/EventBus'
import { CombatSystem } from './CombatSystem'
import type { CombatEntity } from './CombatEntity'
import { createBaseStats } from '../stats/StatBlock'

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

describe('CombatSystem — undefeatable (sec.9 semantic immortality)', () => {
  it('undefeatable entity survives a lethal hit at HP 1 and stays alive', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const beast = createCombatant({ undefeatable: true })

    combat.applyDirectDamage(beast, beast.currentHp + 9999, 'player_1')

    expect(beast.alive).toBe(true)
    expect(beast.currentHp).toBe(1)
  })

  it('undefeatable clamps at 1 again on repeat lethal hits', () => {
    const combat = new CombatSystem(new EventBus())
    const beast = createCombatant({ undefeatable: true })

    combat.applyDirectDamage(beast, beast.currentHp + 1, 'player_1')
    expect(beast.currentHp).toBe(1)

    combat.applyDirectDamage(beast, 9999, 'player_1')
    expect(beast.alive).toBe(true)
    expect(beast.currentHp).toBe(1)
  })

  it('an entity without the flag still dies normally', () => {
    const combat = new CombatSystem(new EventBus())
    const normal = createCombatant()

    combat.applyDirectDamage(normal, normal.currentHp + 1, 'player_1')

    expect(normal.alive).toBe(false)
  })
})
