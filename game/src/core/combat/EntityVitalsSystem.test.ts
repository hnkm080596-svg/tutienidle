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
    currentRage: 0, currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0,
    currentThoThe: 0, currentKimThe: 0, timeSinceLastBleedProc: 0,
 tuLucActive: false,
 tuLucElapsed: 0,
 tuLucDamageTakenPercent: 0,
    timeSinceLastHitTaken: 0, realmIndex: 0, x: 0, row: 2, alive: true,
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
