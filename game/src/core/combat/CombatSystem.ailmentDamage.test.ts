import { describe, expect, it } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffPool } from '../buff/BuffPool'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { buffs } from '../../data/buff/buffs'
import type { CombatEntity } from './CombatEntity'
import type { BuffDefinition } from '../buff/BuffDefinition'

// Plans/magicpathgeneral Phase 9-11 (2026-08-21) — DOT RES + DoT
// source resolution + Poison Recovery, xem CombatSystem.
// applyDotDamage()/BuffSystem.update().

function getTemplate(id: string): BuffDefinition {
  const template = buffs.find(buff => buff.id === id)

  if (!template) {
    throw new Error(`data/buff/buffs.ts thiếu '${id}'`)
  }

  return template
}

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

    source.stats.firePower = 10

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    target.stats.dotResistancePercent = 0.3

    const ailmentSystem = new BuffSystem(new BuffPool())

    ailmentSystem.apply(getTemplate('bong'), source, target)
    // bong: dpsRatio 0.15/tầng (N1 — stackable, spec 2026-09-03 §2.1);
    // nguồn Skill Power = ATK + FirePower
    // (plan §3.2) = 10 + 10 = 20 ->
    // damagePerSecond = 20*0.15 = 3.

    ailmentSystem.update(1, target, combatSystem)

    // 3 raw damage × (1 - 0.3) = 2.1.
    expect(target.currentHp).toBeCloseTo(1000 - 2.1, 5)
  })

  it('emit event damage với effectId đúng, sourceId đúng nguồn gây DoT', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.firePower = 10

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new BuffSystem(new BuffPool())

    ailmentSystem.apply(getTemplate('bong'), source, target)

    const damageEvents: { sourceId?: string; targetId?: string; effectId?: string }[] = []
    eventBus.on('damage', event => damageEvents.push(event as typeof damageEvents[number]))

    ailmentSystem.update(1, target, combatSystem)

    expect(damageEvents).toHaveLength(1)
    expect(damageEvents[0]).toMatchObject({ sourceId: 'source', targetId: 'target', effectId: 'bong' })
  })

  // stat-system-reimagined Task 4 (D18) — CombatSystem queries
  // dotRecoveryTriggers() for authored 'dotRecovery' buff effects on the
  // source; a source carrying none heals 0 on any DoT tick.
  it('wood DoT consults dotRecoveryTriggers — source without a recovery buff heals 0', () => {
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player', currentHp: 500, maxHp: 1000 })

    source.stats.woodPower = 10
    source.stats.firePower = 10

    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const ailmentSystem = new BuffSystem(new BuffPool())

    const resolveSource = (id: string) => (id === source.id ? source : undefined)

    // Trúng Độc (wood) — the trigger hook runs but the source carries
    // no dotRecovery buff: target takes damage, source does NOT heal.
    ailmentSystem.apply(getTemplate('trung_doc'), source, target)
    ailmentSystem.update(1, target, combatSystem, undefined, resolveSource)

    expect(target.currentHp).toBeLessThan(1000)
    expect(source.currentHp).toBe(500)
  })
})
