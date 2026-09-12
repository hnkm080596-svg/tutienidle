import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'
import type { CombatEntity } from '../../combat/CombatEntity'
import type { CombatEvent } from '../../combat/CombatEvent'

// AR-14 QA Probe:
// In headless mode without presentation active, TurnBattleSystem must emit
// the authoritative gameplay 'attack' event on EventBus so passive systems
// and observers receive committed combat actions identically.

function makeEntity(id: string): CombatEntity {
  const stats = createBaseStats({ attack: 100 })
  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    currentThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, priority: number): TurnBattleParticipant {
  return {
    id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new TurnBuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

describe('AR-14: Authoritative attack event emission', () => {
  it('emits gameplay attack event in headless turn resolution', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10)

    const player = makeEntity('player')
    const enemy = makeEntity('enemy')
    enemy.type = 'enemy'

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)

    playerP.basic = {
      id: 'slash',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    const attackEvents: CombatEvent[] = []
    eventBus.on<CombatEvent>('attack', (e) => attackEvents.push(e))

    // Headless step resolution
    system.resolveNextStep(battle)

    expect(attackEvents).toHaveLength(1)
    expect(attackEvents[0]).toMatchObject({
      type: 'attack',
      sourceId: 'player',
      targetId: 'enemy',
      skillId: 'slash',
    })
  })
})
