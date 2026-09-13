import { describe, expect, it } from 'vitest'
import { BuffSystem } from './BuffSystem'
import { BuffPool } from './BuffPool'
import { CombatSystem } from '../combat/CombatSystem'
import type { CombatEntity } from '../combat/CombatEntity'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { SurviveLethalGuard } from '../talent/SurviveLethalGuard'
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'

function entity(id: string): CombatEntity {
  const stats = createBaseStats({ attack: 10000 })
  return {
    id, name: id, type: 'player', baseStats: stats, stats,
    currentHp: 1000, maxHp: 1000, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0,
    currentKimThe: 0, timeSinceLastBleedProc: 0, tuLucActive: false,
    tuLucElapsed: 0, tuLucDamageTakenPercent: 0, currentWard: 0,
    timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
  }
}

describe('R4 canonical buff lifecycle reaudit', () => {
  it('does not tick a second DoT after survive-lethal cleanses it in the same update', () => {
    const source = entity('enemy')
    const target = entity('player')
    const buffs = new BuffSystem(new BuffPool())
    const events = new EventBus()
    const combat = new CombatSystem(events)
    const guard = new SurviveLethalGuard()
    guard.beginBattle(['bat_tu_the'])
    combat.setSurviveLethalSession({
      playerEntityId: target.id, guard,
      surviveEffects: { buffSystem: buffs, registry: BUFF_REGISTRY },
    })
    buffs.apply(BUFF_REGISTRY.get('bong'), source, target, BUFF_REGISTRY)
    buffs.apply(BUFF_REGISTRY.get('trung_doc'), source, target, BUFF_REGISTRY)
    target.currentHp = 1
    const damageEffects: string[] = []
    events.on<{ effectId: string }>('damage', event => damageEffects.push(event.effectId))
    buffs.update(target, combat, BUFF_REGISTRY, id => id === source.id ? source : target)
    expect(buffs.getAll().filter(buff => buff.polarity === 'debuff')).toHaveLength(0)
    expect.soft(damageEffects).toEqual(['bong'])
    expect.soft(target.alive).toBe(true)
    expect(target.currentHp).toBe(1)
  })
})

