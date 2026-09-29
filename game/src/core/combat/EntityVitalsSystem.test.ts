import { describe, expect, it } from 'vitest'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'
import { EntityVitalsSystem, type EntityVitalsChangedEvent } from './EntityVitalsSystem'

function entity(): CombatEntity {
  const stats = createBaseStats()

  return {
    id: 'target', name: 'Target', type: 'enemy', baseStats: stats, stats,
    currentHp: 100, maxHp: 100, currentMp: 50, currentWard: 0,
    turnsSinceLastHitLanded: 0, realmIndex: 0, x: 0, row: 2, alive: true,
  }
}

describe('EntityVitalsSystem', () => {
  it('mutate HP và phát đúng một snapshot ngay lập tức', () => {
    const eventBus = new EventBus()
    const events: EntityVitalsChangedEvent[] = []
    const system = new EntityVitalsSystem(eventBus)
    const target = entity()

    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', event => events.push(event))
    system.applyDamage(target, 25, 'damage', 'boss')

    expect(target.currentHp).toBe(75)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ entityId: 'target', sourceId: 'boss', hpBefore: 100, hpAfter: 75, killed: false })
  })
})

// F-BX-89 - hostile amounts coerce to 0 at the vitals boundary (same
// law as MaterialBag.add/remove): NaN/Infinity can never be written
// into a pool, so killIfDead's `currentHp > 0` check can never see NaN
// and execute an entity that took no real damage.
describe('EntityVitalsSystem - finite boundary (F-BX-89)', () => {
  function finitePools(target: CombatEntity) {
    return [target.currentHp, target.currentWard, target.currentMp].every(Number.isFinite)
  }

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5])(
    'applyDamage(%j) giữ hp hữu hạn, entity không chết ngầm',
    (amount) => {
      const system = new EntityVitalsSystem(new EventBus())
      const target = entity()

      system.applyDamage(target, amount, 'damage', 'boss')

      expect(finitePools(target)).toBe(true)
      expect(target.currentHp).toBe(100)
      expect(target.alive).toBe(true)
    },
  )

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'applyHealing(%j) không được viết NaN/Infinity vào hp',
    (amount) => {
      const system = new EntityVitalsSystem(new EventBus())
      const target = entity()
      target.currentHp = 40

      system.applyHealing(target, amount, 'healing')

      expect(finitePools(target)).toBe(true)
      expect(target.currentHp).toBe(40)
    },
  )

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'spendWard(%j) không poison ward',
    (amount) => {
      const system = new EntityVitalsSystem(new EventBus())
      const target = entity()
      target.currentWard = 30

      system.spendWard(target, amount, 'ward_spend')

      expect(finitePools(target)).toBe(true)
      expect(target.currentWard).toBe(30)
    },
  )

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'grantWard(%j) không poison ward',
    (amount) => {
      const system = new EntityVitalsSystem(new EventBus())
      const target = entity()
      target.stats.wardMax = 100
      target.currentWard = 10

      system.grantWard(target, amount, 'ward_grant')

      expect(finitePools(target)).toBe(true)
      expect(target.currentWard).toBe(10)
    },
  )

  it('applyTurnRegen bỏ qua mọi delta NaN/Infinity, pool giữ nguyên và không emit event', () => {
    const eventBus = new EventBus()
    const events: EntityVitalsChangedEvent[] = []
    const system = new EntityVitalsSystem(eventBus)
    const target = entity()
    target.currentWard = 5

    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', event => events.push(event))

    const applied = system.applyTurnRegen(target, {
      hp: Number.NaN,
      mp: Number.POSITIVE_INFINITY,
      ward: -3,
    })

    expect(applied).toEqual({ hp: 0, mp: 0, ward: 0 })
    expect(finitePools(target)).toBe(true)
    expect(target.currentHp).toBe(100)
    expect(target.currentMp).toBe(50)
    expect(target.currentWard).toBe(5)
    expect(events).toHaveLength(0)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'applyHpDamageFromSnapshot(hpDamage=%j) giữ hp hữu hạn',
    (hpDamage) => {
      const system = new EntityVitalsSystem(new EventBus())
      const target = entity()

      system.applyHpDamageFromSnapshot(target, hpDamage, hpDamage, 'damage', { hp: 100, ward: 0, mp: 50 })

      expect(finitePools(target)).toBe(true)
      expect(target.currentHp).toBe(100)
    },
  )

  it('pool đã poison sẵn (hp=NaN) được coerce về trạng thái nhất quán thay vì NaN vĩnh viễn', () => {
    const system = new EntityVitalsSystem(new EventBus())
    const target = entity()
    target.currentHp = Number.NaN

    system.applyDamage(target, 0, 'damage', 'boss')

    expect(Number.isFinite(target.currentHp)).toBe(true)
    expect(target.currentHp).toBe(0)
  })
})
