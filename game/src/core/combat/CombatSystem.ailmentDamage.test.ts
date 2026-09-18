import { describe, expect, it } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'

// Plans/magicpathgeneral Phase 9-11 (2026-08-21) — DOT RES + DoT
// source resolution + Poison Recovery, xem CombatSystem.applyDotDamage.
// buff2 M4: the periodic TICK emission moved to the buff2 authority
// (periodic requests through the damage adapter); this suite covers the
// damage-channel semantics the tick lands on — DOT RES mitigation,
// event attribution, and the dotRecovery grant consult.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats()

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

describe('CombatSystem.applyDotDamage (Plans/magicpathgeneral Phase 9-11)', () => {
  it('dotResistancePercent giảm thẳng damage của tick DoT', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    target.stats.dotResistancePercent = 0.3

    // bong: dpsRatio 0.15/tầng → the periodic request resolves the tick
    // amount; here the channel gets rawDamage=3 directly (20 power x
    // 0.15, matching the authored coefficient read).
    combatSystem.applyDotDamage({
      sourceId: source.id,
      source,
      target,
      rawDamage: 3,
      element: 'fire',
      effectId: 'bong',
    })

    // 3 raw damage × (1 - 0.3) = 2.1.
    expect(target.currentHp).toBeCloseTo(1000 - 2.1, 5)
  })

  it('emit event damage với effectId đúng, sourceId đúng nguồn gây DoT', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const damageEvents: { sourceId?: string; targetId?: string; effectId?: string }[] = []
    eventBus.on('damage', event => damageEvents.push(event as typeof damageEvents[number]))

    combatSystem.applyDotDamage({
      sourceId: source.id,
      source,
      target,
      rawDamage: 3,
      element: 'fire',
      effectId: 'bong',
    })

    expect(damageEvents).toHaveLength(1)
    expect(damageEvents[0]).toMatchObject({ sourceId: 'source', targetId: 'target', effectId: 'bong' })
  })

  // stat-system-reimagined Task 4 (D18) — CombatSystem queries
  // dotRecoveryTriggers() for authored 'dot_recovery' capability grants
  // on the source; a source carrying none heals 0 on any DoT tick.
  it('wood DoT consults dotRecoveryTriggers — source without a recovery grant heals 0', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player', currentHp: 500, maxHp: 1000 })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    // Trúng Độc (wood) — the trigger hook runs but the source carries
    // no dot_recovery grant: target takes damage, source does NOT heal.
    combatSystem.applyDotDamage({
      sourceId: source.id,
      source,
      sourceGrants: [],
      target,
      rawDamage: 20,
      element: 'wood',
      effectId: 'trung_doc',
    })

    expect(target.currentHp).toBeLessThan(1000)
    expect(source.currentHp).toBe(500)
  })
})
