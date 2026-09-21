import { describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { SeededCombatRng } from '../battle/runtime/rng/SeededCombatRng'
import { CombatScheduler } from '../battle/runtime/scheduler/CombatScheduler'
import type { CombatOperationOrigin } from '../battle/contracts/origin'
import type { CombatEventPayload } from '../battle/contracts/events'
import type { CombatOperationBatch } from '../battle/contracts/settlement'
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
  rewards: { techniqueMastery: 5, spiritStone: 3 },
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
  gameManager.turnBattleOps.applyBuffToPlayer('hoa_an')
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
  expect(gameManager.getBattleBuffs(participant.entity.id)).toHaveLength(0)
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
      return s.techniqueMastery > 0 || s.spiritStone > 0
    })
    const cycle1Loot = gameManager.getBattleRewardSummary()

    fightUntilNextBattle(gameManager, combatSource)

    const cycle2Loot = gameManager.getBattleRewardSummary()
    expect(cycle2Loot.techniqueMastery).toBeGreaterThanOrEqual(cycle1Loot.techniqueMastery)
    expect(cycle2Loot.spiritStone).toBeGreaterThanOrEqual(cycle1Loot.spiritStone)
    expect(gameManager.getActiveTurnBattleStage()?.id).toBe(CYCLE_STAGE.id)
  })

  it('a defeat inside a repeat-armed cycle leaves the stage slot released and no new cycle begins', () => {
    const { gameManager, combatSource, player } = harness()

    const killer = defineEnemy({
      id: 'cycle_killer', name: 'Killer', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 100000, might: 999999, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
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

describe('session RNG (spec C3) — one seeded source owns every combat roll', () => {
  it('mints the session RNG exactly once per beginBattleCycle (P5 T3)', () => {
    const { gameManager } = harness()
    let mints = 0
    gameManager.setBattleRngFactory(() => {
      mints += 1
      return new SeededCombatRng(42)
    })

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    gameManager.turnBattleOps.abandonBattle()
    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)

    // Exactly one fresh stream per cycle -- never shared, never re-minted
    // mid-cycle.
    expect(mints).toBe(2)
  })

  // Rolls exercised: enemy placement, pool/tag picks, hit/evasion,
  // block, crit. The enemy is immortal so no kill runs the out-of-scope
  // loot rolls.
  const TANKY_ENEMY = defineEnemy({
    id: 'rng_tanky', name: 'Tanky', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: {
      maxHp: 1_000_000, might: 5, attackSpeed: 1,
      criticalRate: 0.5, criticalDamage: 1.5, armor: 0,
      evasionRate: 0.4,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })

  const RNG_STAGE: Stage = {
    id: 'rng_stage', name: 'RNG Stage', description: '',
    floor: 1,
    enemyPool: [
      { enemyId: TANKY_ENEMY.id, weight: 1, eliteChance: 0.5 },
      { enemyId: FAST_ENEMY.id, weight: 1 },
    ],
    totalEnemyCount: 4, waves: [2, 2],
    spawnIntervalSeconds: 0,
  }

  function runSeededBattle(seed: number) {
    const { gameManager, combatSource, player } = harness()
    gameManager.setBattleRngFactory(() => new SeededCombatRng(seed))
    player.baseStats = { ...player.baseStats, might: 200, criticalRate: 0.5 } as typeof player.baseStats

    gameManager.catalogOps.registerEnemyTemplates([TANKY_ENEMY, FAST_ENEMY])
    gameManager.catalogOps.registerStages([RNG_STAGE])

    // Capture the call-site stack of every Math.random use: the session
    // boundary requires zero COMBAT rolls on it; out-of-scope economy
    // rolls (loot drop tables via resolveDrops/BattleLootSystem) are
    // allowed and asserted to be the only survivors.
    const randomStacks: string[] = []
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randomStacks.push(new Error().stack ?? '')
      return 0.5
    })

    expect(gameManager.turnBattleOps.startStage(player, RNG_STAGE)).toBe(true)

    const log: unknown[] = []
    for (let i = 0; i < 300; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
      const battle = gameManager.getTurnBattle()
      log.push({
        state: battle?.state,
        turns: battle?.totalTurnsElapsed ?? 0,
        playerHp: battle?.players[0]?.entity.currentHp,
        enemies: battle?.enemies.map(e => ({
          // Entity ids embed a crypto UUID — outside the session-RNG
          // contract (identity, not a roll). Compare the template prefix.
          id: e.entity.id.replace(/_[0-9a-f-]+$/, ''),
          x: e.entity.x, row: e.entity.row,
          hp: e.entity.currentHp, alive: e.entity.alive,
        })),
      })
    }

    return { log, randomStacks }
  }

  it('same seed replays an identical battle; no combat roll touches Math.random', () => {
    const run1 = runSeededBattle(1234)
    const run2 = runSeededBattle(1234)

    expect(run1.log).toEqual(run2.log)
    // Battle positions/rolls differ from pure identity: the log must
    // contain real combat (turns advanced, damage dealt).
    expect(run1.log.some(entry => (entry as { turns?: number }).turns! > 0)).toBe(true)

    // Every remaining Math.random call must come from the out-of-scope
    // economy path (kill loot rolls), never from a combat system.
    const combatLeaks = (stacks: string[]) =>
      stacks.filter(s => !/resolveDrops|BattleLootSystem/.test(s))
    expect(combatLeaks(run1.randomStacks)).toEqual([])
    expect(combatLeaks(run2.randomStacks)).toEqual([])

    vi.restoreAllMocks()
  })

  it('a different seed produces a different battle (the rolls are really consumed)', () => {
    const run1 = runSeededBattle(1)
    const run2 = runSeededBattle(999999)

    expect(run1.log).not.toEqual(run2.log)
    vi.restoreAllMocks()
  })
})

describe('combat-contract scheduler wiring (M4; P5 T2)', () => {
  const WIRE_ORIGIN: CombatOperationOrigin = {
    kind: 'skill',
    originId: 'test.wire',
    sourceId: 'player',
    rootActionId: 'action.wire.1',
  }

  it('beginBattleCycle exposes a fresh live-wired CombatScheduler through the engine', () => {
    const { gameManager } = harness()
    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)

    const scheduler = gameManager.turnBattleOps.getTurnBattleSystem().combatScheduler
    expect(scheduler).toBeInstanceOf(CombatScheduler)
    if (scheduler === undefined) {
      throw new Error('combatScheduler was not injected into TurnBattleSystem')
    }

    // Kill the enemy ENTITY only -- the participant.alive cache stays
    // stale-true, so only a resolver reading the LIVE entity can see the
    // death (exactly what the wiring probes below must prove).
    const enemy = gameManager.getTurnBattle()!.enemies[0]!
    enemy.entity.alive = false
    expect(enemy.alive).toBe(true)

    // (a) A batch whose entity_alive precondition fails must be skipped
    // atomically as stale -- proving the precondition read-port is wired
    // to the live roster rather than a phantom lookup.
    // The probe registers on 'buff_stacks_changed' -- an unclaimed type:
    // 'elemental_application_committed' is now production-owned by the
    // canonical-seals S3 dispatcher (registerImmediateHandler faults on
    // duplicates, which is exactly the single-registration guarantee).
    const probe: CombatEventPayload = {
      type: 'buff_stacks_changed',
      rootActionId: 'action.wire.1',
      instanceId: 'bi.wire',
      stacksBefore: 0,
      stacksAfter: 1,
      addedStacks: 1,
    }
    const batch: CombatOperationBatch = {
      batchId: 'b.wire',
      origin: WIRE_ORIGIN,
      preconditions: [{ kind: 'entity_alive', entityId: enemy.id }],
      operations: [
        {
          operationId: 'op.wire.batch',
          type: 'push_gauge',
          origin: WIRE_ORIGIN,
          payload: { targetId: enemy.id, fractionOfMax: 0.5 },
        },
      ],
    }
    scheduler.registerImmediateHandler('buff_stacks_changed', () => ({
      kind: 'batch',
      batch,
    }))
    scheduler.createLifecycleSink('action.wire.1').sink.emit(probe)

    // (b) An authored gauge op on the dead entity must reach the adapter
    // and skip as invalid_target_state -- the adapter resolves the LIVE
    // entity (dead), not the stale participant cache (alive).
    scheduler.enqueueAuthored([
      {
        operationId: 'op.wire.gauge',
        type: 'push_gauge',
        origin: WIRE_ORIGIN,
        payload: { targetId: enemy.id, fractionOfMax: 0.5 },
      },
    ])

    scheduler.run()

    expect(scheduler.trace.batchSkips).toEqual([
      {
        batchId: 'b.wire',
        reason: 'stale_reaction_snapshot',
        operationIds: ['op.wire.batch'],
      },
    ])
    const gaugeRecord = scheduler.trace.records.find(
      (r) => r.operation.operationId === 'op.wire.gauge',
    )
    expect(gaugeRecord?.result.status).toBe('skipped')
    expect(gaugeRecord?.result.reason).toBe('invalid_target_state')
    expect(scheduler.state).toBe('running')

    // The next cycle mints a NEW scheduler instance (fresh causal store,
    // fresh budget, fresh trace).
    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    const next = gameManager.turnBattleOps.getTurnBattleSystem().combatScheduler
    expect(next).toBeInstanceOf(CombatScheduler)
    expect(next).not.toBe(scheduler)
  })
})
