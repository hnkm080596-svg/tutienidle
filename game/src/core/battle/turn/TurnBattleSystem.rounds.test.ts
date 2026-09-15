import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'

// Round tracking (spec v3 D1 revision, 2026-09-12): perfectClearTurnLimit
// counts ATB ROUNDS, not actor actions. A round completes when every
// participant alive at that moment has declared an action since the
// previous boundary. These tests pin the semantics on the real
// declareActorAction code path.

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
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return {
    id,
    entity: combatEntity,
    speed,
    priority,
    actionGauge: 0,
    alive: combatEntity.alive,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

function harness() {
  const player = makeParticipant('player', createCombatant({ id: 'player', type: 'player' }), 10, 0)
  const e1 = makeParticipant('e1', createCombatant({ id: 'e1' }), 10, 1)
  const e2 = makeParticipant('e2', createCombatant({ id: 'e2' }), 10, 2)

  const battle: TurnBattle = {
    players: [player],
    enemies: [e1, e2],
    state: 'fighting',
    totalTurnsElapsed: 0,
    roundsElapsed: 0,
    actedThisRound: [],
  }

  const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

  return { battle, system, player, e1, e2 }
}

describe('TurnBattleSystem round tracking (roundsElapsed / actedThisRound)', () => {
  it('one action each from player + 2 enemies completes round 1 and clears actedThisRound', () => {
    const { battle, system, player, e1, e2 } = harness()

    system.declareActorAction(battle, player)
    system.declareActorAction(battle, e1)
    expect(battle.roundsElapsed).toBe(0)
    expect(battle.actedThisRound).toEqual(['player', 'e1'])

    system.declareActorAction(battle, e2)
    expect(battle.roundsElapsed).toBe(1)
    expect(battle.actedThisRound).toEqual([])
  })

  it('the same actor declaring twice does not double-count (dedupe by participant id)', () => {
    const { battle, system, player } = harness()

    system.declareActorAction(battle, player)
    system.declareActorAction(battle, player)

    expect(battle.roundsElapsed).toBe(0)
    expect(battle.actedThisRound).toEqual(['player'])
  })

  it('a participant that dies mid-round is excluded - the round can close without it', () => {
    const { battle, system, player, e1, e2 } = harness()

    system.declareActorAction(battle, player)
    system.declareActorAction(battle, e1)
    e1.entity.alive = false // killed by the player's hit

    system.declareActorAction(battle, e2)

    expect(battle.roundsElapsed).toBe(1)
    expect(battle.actedThisRound).toEqual([])
  })

  it('a new enemy pushed into battle.enemies mid-round must act before the round closes', () => {
    const { battle, system, player, e1, e2 } = harness()

    system.declareActorAction(battle, player)
    system.declareActorAction(battle, e1)
    system.declareActorAction(battle, e2)
    expect(battle.roundsElapsed).toBe(1)

    // Wave spawn mid-round: e3 joins the CURRENT round, so the boundary
    // cannot close until it declares.
    const e3 = makeParticipant('e3', createCombatant({ id: 'e3' }), 10, 3)
    battle.enemies.push(e3)

    system.declareActorAction(battle, player)
    system.declareActorAction(battle, e1)
    system.declareActorAction(battle, e2)
    expect(battle.roundsElapsed).toBe(1)

    system.declareActorAction(battle, e3)
    expect(battle.roundsElapsed).toBe(2)
    expect(battle.actedThisRound).toEqual([])
  })
})
