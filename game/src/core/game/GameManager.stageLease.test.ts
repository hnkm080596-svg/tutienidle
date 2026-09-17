import { describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'

// Mission C audit (round: lease/ownership review) — the stage slot is a
// capability and the launch is a transaction:
//
//   C1  an exception after acquire (enemy pick OR launch chain) must roll
//       the lease back — a thrown start can never leave the global slot
//       occupied (the same soft-lock family Mission B removed).
//   C2  a refused startStage must be a no-op on the RUNNING battle: the
//       cycle RNG is minted as a candidate and committed only when the
//       new cycle actually begins inside beginBattleCycle.
//   C4  ownership is object-identity, not occupancy: a stale stopRepeat
//       (abandon on a dead battle reference) must not stomp a foreign
//       lease, and the repeat gate asks "do I still hold MY lease", not
//       "does anyone hold the slot".

const DUMMY = defineEnemy({
  id: 'lease_dummy', name: 'Lease Dummy', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 10, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueInsight: 0, spiritStone: 0 },
})

const FRAGILE_DUMMY = defineEnemy({
  id: 'lease_fragile', name: 'Fragile Dummy', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueInsight: 0, spiritStone: 0 },
})

function stageFixture(id: string, enemyId: string): Stage {
  return {
    id, name: id, description: '', floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: 1, waves: [1],
    spawnIntervalSeconds: 0,
  }
}

function setup(...enemies: ReturnType<typeof defineEnemy>[]) {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  const player = createDefaultPlayer()
  player.baseStats = asBaseStats({ ...player.baseStats, might: 100, speed: 100 })
  gameManager.catalogOps.registerEnemyTemplates([...enemies])
  gameManager.setActivePlayer(player)
  return { gameManager, combatSource, player }
}

describe('C1 — stage launch is a transaction (lease rolls back on throw)', () => {
  it('launch-chain throw releases the lease and a retry can start cleanly', () => {
    const { gameManager, player } = setup(DUMMY)
    const stage = stageFixture('throw_stage', DUMMY.id)
    gameManager.catalogOps.registerStages([stage])

    // Path-runtime resolution (Ngộ Đạo missing-skill class) throws inside
    // the launch chain — after acquire, before commit.
    gameManager.turnBattleOps.setPathRuntimeResolver(() => {
      throw new Error('path runtime boom')
    })

    expect(() => gameManager.turnBattleOps.startStage(player, stage, false)).toThrow('path runtime boom')
    expect(gameManager.stageManager.get()).toBeNull()

    // The slot is free: a fixed retry starts instead of soft-locking.
    gameManager.turnBattleOps.setPathRuntimeResolver(undefined)
    expect(gameManager.turnBattleOps.startStage(player, stage, false)).toBe(true)
  })

  it('enemy-pick throw (broken authored stage data) releases the lease', () => {
    const { gameManager, player } = setup(DUMMY)
    // authored-broken stage: empty pool -> weightedRandom throws.
    const broken = stageFixture('broken_stage', DUMMY.id)
    broken.enemyPool = []
    gameManager.catalogOps.registerStages([broken])

    expect(() => gameManager.turnBattleOps.startStage(player, broken, false)).toThrow()
    expect(gameManager.stageManager.get()).toBeNull()
  })
})

describe('C2 — refused startStage is a no-op on the running battle', () => {
  it('occupied-slot refusal never installs a new cycle RNG', () => {
    const { gameManager, player } = setup(DUMMY)
    const stageA = stageFixture('rng_stage_a', DUMMY.id)
    const stageB = stageFixture('rng_stage_b', DUMMY.id)
    gameManager.catalogOps.registerStages([stageA, stageB])

    const streams: Array<() => number> = []
    gameManager.turnBattleOps.setBattleRngFactory(() => {
      const stream = vi.fn(() => 0.5)
      streams.push(stream)
      return stream
    })
    const setSource = vi.spyOn(gameManager.combatSystem, 'setRandomSource')

    expect(gameManager.turnBattleOps.startStage(player, stageA, false)).toBe(true)
    const liveStream = streams.at(-1)!
    const installsAfterA = setSource.mock.calls.length

    // Refused: stage B cannot acquire the slot stage A holds.
    expect(gameManager.turnBattleOps.startStage(player, stageB, false)).toBe(false)

    // The running battle's RNG authority is untouched — no install, same
    // stream still live.
    expect(setSource.mock.calls.length).toBe(installsAfterA)
    expect(setSource.mock.calls.at(-1)?.[0]).toBe(liveStream)
    expect(gameManager.stageManager.get()?.stageId).toBe(stageA.id)
  })
})

describe('C4 — slot ownership is object-identity, not occupancy', () => {
  it('a stale stopRepeat (abandonBattle) cannot release a foreign lease', () => {
    const { gameManager, player } = setup(DUMMY)
    const stageA = stageFixture('owner_stage_a', DUMMY.id)
    const stageB = stageFixture('owner_stage_b', DUMMY.id)
    gameManager.catalogOps.registerStages([stageA, stageB])

    expect(gameManager.turnBattleOps.startStage(player, stageA, false)).toBe(true)

    // The wave system's lease dies abnormally (e.g. an earlier unwind
    // already released it) and a foreign owner takes the slot. A stale
    // stopRepeat — fired from this battle's abandon path — must leave the
    // foreign lease alone.
    gameManager.stageManager.release(gameManager.stageManager.get()!)
    const foreign = gameManager.stageManager.acquire(stageB)
    expect(foreign).not.toBeNull()

    expect(gameManager.abandonBattle()).toBe(true)
    expect(gameManager.stageManager.get()).toBe(foreign)
  })

  it('repeat-on-victory does not restart when the slot is held by a foreign owner', () => {
    const { gameManager, combatSource, player } = setup(FRAGILE_DUMMY)
    const stageA = stageFixture('repeat_gate_a', FRAGILE_DUMMY.id)
    const stageB = stageFixture('repeat_gate_b', FRAGILE_DUMMY.id)
    gameManager.catalogOps.registerStages([stageA, stageB])

    expect(gameManager.turnBattleOps.startStage(player, stageA, true)).toBe(true)
    const generation = gameManager.turnBattleOps.getBattleGeneration()

    // Wave lease dies, foreign owner takes the slot BEFORE the victory
    // terminal evaluates the repeat condition.
    gameManager.stageManager.release(gameManager.stageManager.get()!)
    expect(gameManager.stageManager.acquire(stageB)).not.toBeNull()

    for (let i = 0; i < 4_000 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }
    expect(gameManager.getTurnBattle()?.state).toBe('victory')

    // Repeat must NOT fire: the slot is held, but not by this stage run.
    for (let i = 0; i < 50; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }
    expect(gameManager.turnBattleOps.getBattleGeneration()).toBe(generation)
    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect(gameManager.stageManager.get()?.stageId).toBe(stageB.id)
  })
})
