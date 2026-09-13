import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import type { BuffDefinition, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'

// AR-06 QA Probes:
// Turn DoT omits its source context if resolveSource is not passed to
// actorBuffSystem.update(). CombatSystem.applyDotDamage needs source to
// apply elemental penetration and poisonRecoveryPercent leech healing.

const POISON_BUFF: BuffDefinition = {
  id: 'qa_poison',
  name: 'QA Poison',
  polarity: 'debuff',
  duration: 3,
  stackMode: 'stack',
  effects: [{ type: 'dot', dpsRatio: 1, element: 'wood' }],
}

const REGISTRY: BuffDefinitionCatalog = {
  get: (id: string): BuffDefinition => {
    if (id === POISON_BUFF.id) return POISON_BUFF
    throw new Error(`unknown buff id: ${id}`)
  },
}

function makeEntity(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, ...overrides.stats })
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
    ...overrides,
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
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

describe('AR-06: Turn DoT source context', () => {
  it('supplies living source to DoT tick, enabling poisonRecoveryPercent healing', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10, REGISTRY)

    // Player is the source of the poison, with 50% poison recovery and missing HP.
    const player = makeEntity('player', {
      currentHp: 500,
      maxHp: 1000,
      stats: createBaseStats({ speed: 10, poisonRecoveryPercent: 0.5 }),
    })

    // Enemy has poison applied to its buff pool and is faster (speed 100 vs 10).
    const enemy = makeEntity('enemy', {
      currentHp: 10_000,
      maxHp: 10_000,
      stats: createBaseStats({ speed: 100 }),
    })

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)

    new BuffSystem(enemyP.buffs).apply(POISON_BUFF, player, enemy, REGISTRY)

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    const hpBefore = player.currentHp

    // Resolve enemy turn: enemy ticks poison -> takes DoT damage -> player heals 50% of damage.
    system.resolveNextStep(battle)

    // With resolveSource, enemy takes DoT and player heals via poisonRecoveryPercent.
    expect(player.currentHp).toBeGreaterThan(hpBefore)
    expect(enemy.currentHp).toBeLessThan(10_000)
  })

  it('handles dead or missing source safely without throwing', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10, REGISTRY)

    const player = makeEntity('player', {
      currentHp: 0,
      alive: false,
    })
    const enemy = makeEntity('enemy', {
      currentHp: 10_000,
      maxHp: 10_000,
    })

    const playerP = makeParticipant('player', player, 0)
    playerP.alive = false
    const enemyP = makeParticipant('enemy', enemy, 1)

    new BuffSystem(enemyP.buffs).apply(POISON_BUFF, player, enemy, REGISTRY)

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    // Must not throw when ticking DoT with dead source.
    expect(() => system.resolveNextStep(battle)).not.toThrow()
  })
})
