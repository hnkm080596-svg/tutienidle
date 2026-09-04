import { describe, expect, it } from 'vitest'
import { peekUpcomingActors, type BattleLogEntry } from './TurnOrderPreview'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { CombatEntity } from '../../combat/CombatEntity'
import { TurnBuffPool } from './TurnBuffPool'

// Slice 7 extension (Completion Task 11) — turn-order preview: trả N actor
// kế tiếp theo gauge-fill order mà KHÔNG mutate battle thật (so gauge
// before/after phải không đổi), và battle log: 1 entry/resolveActorTurn.

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

function makeParticipant(
  id: string,
  entity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return {
    id, entity, speed, priority, actionGauge: 0, alive: entity.alive,
    buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0,
    basic: { id: `${id}_basic`, cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
  }
}

function mkBattle(): TurnBattle {
  const player = createCombatant({ id: 'player', type: 'player', row: 4 })
  const enemyFast = createCombatant({ id: 'enemyFast', currentHp: 1_000_000, maxHp: 1_000_000 })
  const enemySlow = createCombatant({ id: 'enemySlow', currentHp: 1_000_000, maxHp: 1_000_000 })

  const playerParticipant = makeParticipant('player', player, 20, 0)
  playerParticipant.actionGauge = 0

  return {
    players: [playerParticipant],
    enemies: (() => {
      const fast = makeParticipant('enemyFast', enemyFast, 10, 1)
      fast.actionGauge = 990 // ready @1 step

      return [fast, makeParticipant('enemySlow', enemySlow, 5, 2)] // ready @200 steps
    })(),
    state: 'fighting',
  }
}

describe('peekUpcomingActors', () => {
  it('returns N actors in gauge-fill order WITHOUT mutating the real battle', () => {
    const battle = mkBattle()
    const gaugeBefore = {
      player: battle.players[0]!.actionGauge,
      fast: battle.enemies[0]!.actionGauge,
      slow: battle.enemies[1]!.actionGauge,
    }

    // Gauge lệch pha: enemyFast ready @1 step, player @50, player-2nd @100,
    // enemySlow @200. Preview 3 lượt kế: enemyFast → player → player.
    const upcoming = peekUpcomingActors(battle, 3)

    expect(upcoming.map((a) => a.id)).toEqual(['enemyFast', 'player', 'player'])
    expect(battle.players[0]!.actionGauge).toBe(gaugeBefore.player)
    expect(battle.enemies[0]!.actionGauge).toBe(gaugeBefore.fast)
    expect(battle.enemies[1]!.actionGauge).toBe(gaugeBefore.slow)
    expect(battle.totalTurnsElapsed ?? 0).toBe(0)
    expect(battle.state).toBe('fighting')
  })

  it('returns exactly `count` entries when all actors stay alive (ATB preview counts turns, not unique actors)', () => {
    const battle = mkBattle()

    expect(peekUpcomingActors(battle, 10)).toHaveLength(10)
  })
})

describe('battle log (resolveActorTurn)', () => {
  it('appends one entry per resolved turn with turn/actorId/skillId/targetIds/ccBlocked', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      row: 4,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 10, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    expect(battle.log).toHaveLength(2)

    const first = battle.log![0] as BattleLogEntry

    expect(first.turn).toBe(1)
    expect(first.actorId).toBe('player')
    expect(first.targetIds).toEqual(['enemy'])
    expect(first.ccBlocked).toBe(false)
  })
})
