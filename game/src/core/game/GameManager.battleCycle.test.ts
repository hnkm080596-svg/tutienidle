import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'

// Mission C (spec C1/C2) — the fresh-battle lifecycle contract.
// beginBattleCycle(policy) is the single lifecycle owner; the four entry
// paths (startBattle, startBattleWithPlayer, startStage,
// restartTurnBattleCycle) all delegate to it and must produce an
// identical battle-scoped reset. A repeat cycle is a FRESH battle: only
// stage binding, repeat arm, player identity, accumulated loot session,
// and the run timer carry over.

function harness() {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  const player = createDefaultPlayer()
  gameManager.setActivePlayer(player)
  return { gameManager, combatSource, player }
}

function createCombatPlayer(): CombatEntity {
  const stats = createBaseStats({ might: 50, speed: 100, criticalRate: 0 })
  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 4,
    alive: true,
  }
}

const FAST_ENEMY = defineEnemy({
  id: 'cycle_fast_mob', name: 'Fast Mob', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueInsight: 5, spiritStone: 3 },
})

const CYCLE_STAGE: Stage = {
  id: 'cycle_stage', name: 'Cycle Stage', description: '',
  floor: 1, enemyPool: [{ enemyId: FAST_ENEMY.id, weight: 1 }],
  totalEnemyCount: 3, waves: [3],
  spawnIntervalSeconds: 0,
}

// Poison the live battle's player-side state with every battle-scoped
// field the reset list owns; the next cycle must observe none of it.
function poisonBattleState(gameManager: GameManager) {
  const participant = gameManager.getTurnBattle()!.players[0]!
  participant.entity.currentHp = Math.max(1, Math.floor(participant.entity.maxHp * 0.3))
  participant.entity.currentWard = 0
  participant.entity.currentThe = 40
  participant.entity.externalWard = { sourceId: 'ext_source', amount: 999 }
  participant.buffs.add({
    id: 'cycle_poison_debuff',
    sourceId: participant.entity.id,
    targetId: participant.entity.id,
    polarity: 'debuff',
    duration: 10,
    remainingTurns: 10,
    stacks: 1,
    stackMode: 'stack',
    effects: [],
  })
  if (participant.special) {
    participant.special.remainingCooldownTurns = 3
  }
  participant.actionGauge = 500
  participant.chargingTurnsRemaining = 2
}

function expectFreshPlayerSide(gameManager: GameManager) {
  const participant = gameManager.getTurnBattle()!.players[0]!
  expect(participant.entity.currentHp).toBe(participant.entity.maxHp)
  // A fresh CombatEntity may not declare currentThe at all (path field);
  // the contract is "no carried pool", i.e. effectively zero.
  expect(participant.entity.currentThe ?? 0).toBe(0)
  expect(participant.entity.externalWard).toBeUndefined()
  expect(participant.buffs.getAll().length).toBe(0)
  expect(participant.special?.remainingCooldownTurns ?? 0).toBe(0)
  expect(participant.actionGauge).toBeLessThan(500)
  expect(participant.chargingTurnsRemaining ?? 0).toBe(0)
}

// Advance the real update loop until getTurnBattle() returns a NEW battle
// object — beginBattleCycle always builds a fresh TurnBattle, so a
// reference change IS the cycle boundary (this assertion is itself part
// of the contract).
function fightUntilNextBattle(gameManager: GameManager, combatSource: ManualClockSource) {
  const previous = gameManager.getTurnBattle()
  for (let i = 0; i < 2000; i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
    const current = gameManager.getTurnBattle()
    if (current !== null && current !== previous) return current
  }
  throw new Error('no new battle cycle within 2000 combat steps')
}

function fightUntil(gameManager: GameManager, combatSource: ManualClockSource, predicate: () => boolean) {
  for (let i = 0; i < 2000; i++) {
    if (predicate()) return
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
  throw new Error('predicate not reached within 2000 combat steps')
}

describe('beginBattleCycle — the four entry paths produce one reset contract', () => {
  it('startBattle (test policy) resets battle-scoped player state', () => {
    const { gameManager } = harness()

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    poisonBattleState(gameManager)

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    expectFreshPlayerSide(gameManager)
  })

  it('startStage (stage policy) resets battle-scoped player state', () => {
    const { gameManager, player } = harness()
    gameManager.catalogOps.registerEnemyTemplates([FAST_ENEMY])
    gameManager.catalogOps.registerStages([CYCLE_STAGE])

    expect(gameManager.turnBattleOps.startStage(player, CYCLE_STAGE)).toBe(true)
    poisonBattleState(gameManager)
    gameManager.turnBattleOps.abandonBattle()

    expect(gameManager.turnBattleOps.startStage(player, CYCLE_STAGE)).toBe(true)
    expectFreshPlayerSide(gameManager)
  })

  it('startStage enters intro state and keeps the stage binding', () => {
    const { gameManager, player } = harness()
    gameManager.catalogOps.registerEnemyTemplates([FAST_ENEMY])
    gameManager.catalogOps.registerStages([CYCLE_STAGE])

    expect(gameManager.turnBattleOps.startStage(player, CYCLE_STAGE)).toBe(true)
    expect(gameManager.getTurnBattle()!.state).toBe('intro')
    expect(gameManager.getActiveTurnBattleStage()?.id).toBe(CYCLE_STAGE.id)
  })
})

describe('repeat policy — a repeat cycle is provably a fresh battle', () => {
  function repeatHarness() {
    const { gameManager, combatSource, player } = harness()
    gameManager.catalogOps.registerEnemyTemplates([FAST_ENEMY])
    gameManager.catalogOps.registerStages([CYCLE_STAGE])
    expect(gameManager.turnBattleOps.startStage(player, CYCLE_STAGE, true)).toBe(true)
    return { gameManager, combatSource, player }
  }

  it('leaks no battle-scoped player state into cycle 2', () => {
    const { gameManager, combatSource } = repeatHarness()

    // Let the battle really start before poisoning it.
    fightUntil(gameManager, combatSource, () => gameManager.getTurnBattle()?.state === 'fighting')
    poisonBattleState(gameManager)
    const cycle1Entity = gameManager.getTurnBattle()!.players[0]!.entity

    fightUntilNextBattle(gameManager, combatSource)

    expectFreshPlayerSide(gameManager)
    // Fresh battle, fresh player-side entity object.
    expect(gameManager.getTurnBattle()!.players[0]!.entity).not.toBe(cycle1Entity)
  })

  it('cycle 2 starts in fighting state with zeroed turn counters and empty acted set', () => {
    const { gameManager, combatSource } = repeatHarness()

    fightUntilNextBattle(gameManager, combatSource)

    const battle = gameManager.getTurnBattle()!
    expect(battle.state).toBe('fighting')
    expect(battle.totalTurnsElapsed ?? 0).toBe(0)
    expect(battle.roundsElapsed ?? 0).toBe(0)
    expect(battle.actedThisRound ?? []).toHaveLength(0)
  })

  it('preserves the loot session and the stage binding across the repeat', () => {
    const { gameManager, combatSource } = repeatHarness()

    fightUntil(gameManager, combatSource, () => gameManager.getTurnBattle()?.state === 'fighting')
    // Cycle 1 kills grant rewards into the accumulated session.
    fightUntil(gameManager, combatSource, () => {
      const s = gameManager.getBattleRewardSummary()
      return s.techniqueInsight > 0 || s.spiritStone > 0
    })
    const cycle1Loot = gameManager.getBattleRewardSummary()

    fightUntilNextBattle(gameManager, combatSource)

    const cycle2Loot = gameManager.getBattleRewardSummary()
    expect(cycle2Loot.techniqueInsight).toBeGreaterThanOrEqual(cycle1Loot.techniqueInsight)
    expect(cycle2Loot.spiritStone).toBeGreaterThanOrEqual(cycle1Loot.spiritStone)
    expect(gameManager.getActiveTurnBattleStage()?.id).toBe(CYCLE_STAGE.id)
  })

  it('a defeat inside a repeat-armed cycle leaves the stage slot released and no new cycle begins', () => {
    const { gameManager, combatSource, player } = harness()

    const killer = defineEnemy({
      id: 'cycle_killer', name: 'Killer', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 100000, might: 999999, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const stage: Stage = {
      id: 'cycle_kill_stage', name: 'Kill Stage', description: '',
      floor: 1, enemyPool: [{ enemyId: killer.id, weight: 1 }],
      totalEnemyCount: 1, waves: [1],
      spawnIntervalSeconds: 0,
    }
    gameManager.catalogOps.registerEnemyTemplates([killer])
    gameManager.catalogOps.registerStages([stage])
    expect(gameManager.turnBattleOps.startStage(player, stage, true)).toBe(true)

    fightUntil(gameManager, combatSource, () => gameManager.getTurnBattle()?.state === 'defeat')

    // Mission B contract pinned to the new lifecycle owner: defeat
    // releases the stage slot and disarms repeat even while armed.
    expect(gameManager.turnBattleOps.getStageProgress()).toBeNull()

    // Advancing further must NOT silently start a new cycle.
    const defeated = gameManager.getTurnBattle()!
    for (let i = 0; i < 200; i++) combatSource.advance(COMBAT_STEP_SECONDS)
    expect(gameManager.getTurnBattle()).toBe(defeated)
  })
})

describe('beginBattleCycle — pending-state teardown (spec C1 reset inventory)', () => {
  it('startBattle clears an awaited manual choice from the previous battle', () => {
    const { gameManager, combatSource } = harness()
    gameManager.setBattleManualMode(true)

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    fightUntil(gameManager, combatSource, () => gameManager.isAwaitingManualTurnChoice())

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)

    // The new cycle may reach a manual pause only by taking turns;
    // immediately after start there is no carried-over awaited actor.
    expect(gameManager.isAwaitingManualTurnChoice()).toBe(false)
  })

  it('a stale playback ack from battle 1 cannot drain battle 2 pending playback', () => {
    const { gameManager, combatSource } = harness()
    gameManager.setPresentationActive(true)

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    fightUntil(gameManager, combatSource, () => gameManager.getPendingPlaybackToken() !== null)
    const staleToken = gameManager.getPendingPlaybackToken()!

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    fightUntil(gameManager, combatSource, () => gameManager.getPendingPlaybackToken() !== null)
    const liveToken = gameManager.getPendingPlaybackToken()!
    expect(liveToken).not.toBe(staleToken)

    gameManager.acknowledgeActionImpact(staleToken)
    expect(gameManager.getPendingPlaybackToken()).toBe(liveToken)
  })

  it('playback tokens are monotonic across cycles', () => {
    const { gameManager, combatSource } = harness()
    gameManager.setPresentationActive(true)

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    fightUntil(gameManager, combatSource, () => gameManager.getPendingPlaybackToken() !== null)
    const firstToken = gameManager.getPendingPlaybackToken()!

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    fightUntil(gameManager, combatSource, () => gameManager.getPendingPlaybackToken() !== null)
    const secondToken = gameManager.getPendingPlaybackToken()!

    const seqOf = (token: string) => Number(token.replace('playback-', ''))
    expect(seqOf(secondToken)).toBeGreaterThan(seqOf(firstToken))
  })
})
