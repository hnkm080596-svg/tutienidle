import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'

const COUNTER_DEF: TurnBuffDefinition = {
  id: 'react_counter',
  name: 'Counter Stance',
  polarity: 'buff',
  duration: 2,
  stackMode: 'refresh',
  effects: [{ type: 'reactiveTrigger', trigger: 'onImpactLanded', chance: 1, queuesFollowUp: true }],
}

class Registry implements TurnBuffRegistry {
  private readonly defs = new Map<string, TurnBuffDefinition>()
  constructor(defs: TurnBuffDefinition[]) {
    for (const d of defs) this.defs.set(d.id, d)
  }
  get(id: string): TurnBuffDefinition {
    const d = this.defs.get(id)
    if (!d) throw new Error(`missing buff: ${id}`)
    return d
  }
}

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return {
    id, entity, speed, priority, actionGauge: 0, alive: entity.alive,
    buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0,
    basic: { id: `${id}_basic`, cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
  }
}

function fixture() {
  const player = createCombatant({
    id: 'player', type: 'player', row: 4,
    stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 100 },
  })
  const enemyEntity = createCombatant({
    id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000,
    stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 10, attack: 0 },
  })

  const playerParticipant = makeParticipant('player', player, 100, 0)
  const enemyParticipant = makeParticipant('enemy', enemyEntity, 10, 1)
  const registry = new Registry([COUNTER_DEF])
  const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, registry)

  new TurnBuffSystem(enemyParticipant.buffs).apply(COUNTER_DEF, player, enemyEntity, registry)

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  return { battle, system, playerParticipant, enemyParticipant }
}

describe('TurnBattleSystem — queuedFollowUpActorIds honored by the PRODUCTION loop (tickPacing)', () => {
  it('tickPacing() grants the queued follow-up actor a bypass turn on the NEXT call, not just peekNextActor()', () => {
    const { battle, system, enemyParticipant } = fixture()

    // Player's gauge-ready turn resolves via tickPacing (the real game-loop
    // entry point) — advance gauges to ready first (speed 100 → 10 ticks),
    // then the ready tick resolves: hits enemy, enemy's counter fires,
    // queues itself.
    for (let i = 0; i < 9; i++) {
      system.tickPacing(battle)
    }

    const firstActor = system.tickPacing(battle)
    expect(firstActor?.id).toBe('player')
    expect(battle.queuedFollowUpActorIds).toEqual(['enemy'])

    // Enemy's own gauge is nowhere near ready yet (fresh actionGauge=0,
    // needs many ticks) — the ONLY way it can act next is the bypass queue.
    expect(enemyParticipant.actionGauge).toBeLessThan(1000)

    const secondActor = system.tickPacing(battle)

    expect(secondActor?.id).toBe('enemy')
    expect(battle.queuedFollowUpActorIds).toBeUndefined()
  })

  it("bypass turn does NOT consume the follow-up actor's own gauge progress", () => {
    const { battle, system, enemyParticipant } = fixture()

    for (let i = 0; i < 9; i++) {
      system.tickPacing(battle)
    }

    system.tickPacing(battle) // player turn, queues enemy follow-up
    enemyParticipant.actionGauge = 500 // simulate enemy had already built up progress

    system.tickPacing(battle) // enemy's bypass turn

    expect(enemyParticipant.actionGauge).toBe(500)
  })
})

describe('TurnBattleSystem — follow-up reciprocity guard', () => {
  it('caps consecutive bypass turns and falls back to normal gauge order', () => {
    const { battle, system } = fixture()

    // Manually simulate a long chain having already happened (rather than
    // building a full ping-pong buff setup) — verify the guard itself.
    battle.queuedFollowUpActorIds = ['enemy']
    battle.followUpChainDepth = 4 // MAX_FOLLOW_UP_CHAIN_DEPTH

    const result = system.tickPacing(battle, false)

    // Guard tripped: queue dropped, falls through to normal (gauge not
    // ready yet for either side at actionGauge=0) → no actor this tick.
    expect(battle.queuedFollowUpActorIds).toBeUndefined()
    expect(battle.followUpChainDepth).toBe(0)
    expect(result).toBeNull()
  })
})
