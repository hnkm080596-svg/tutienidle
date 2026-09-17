import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { GameManagerAutoFarmOps } from './GameManagerAutoFarmOps'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'

const DUMMY = defineEnemy({
  id: 'adv_dummy', name: 'Adv Dummy', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 10, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueInsight: 0, spiritStone: 5 },
})
const STAGE = {
  id: 'adv_stage', name: 'Adv Stage', description: '', floor: 1,
  enemyPool: [{ enemyId: 'adv_dummy', weight: 1 }], totalEnemyCount: 2, waves: [2], spawnIntervalSeconds: 0,
}

describe('Adversarial — offline auto-farm invariants (QA quick)', () => {
  it('settle tiến lastCheckedMs ĐÚNG bằng cycles đã roll (2 cycles trên 120s)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.catalogOps.registerEnemyTemplates([DUMMY])
    gameManager.catalogOps.registerStages([STAGE])
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = 100 // cycle 50s

    const lastCheckedMs = Date.now() - 120_000
    player.autoFarmStage = { stageId: 'adv_stage', lastCheckedMs }

    // Settle 120s = 2 cycles (50s mỗi cycle) + 20s dư → lastCheckedMs tiến 100s.
    gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 120)
    const afterFirst = player.autoFarmStage!.lastCheckedMs

    expect(afterFirst).toBeGreaterThanOrEqual(lastCheckedMs + 100_000 - 1000)
    expect(afterFirst).toBeLessThanOrEqual(lastCheckedMs + 100_000 + 1000)
  })

  it('elapsed ÂM (clock rollback) → no-op, lastCheckedMs KHÔNG lùi', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.catalogOps.registerEnemyTemplates([DUMMY])
    gameManager.catalogOps.registerStages([STAGE])
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = 100

    const lastCheckedMs = Date.now() - 10_000
    player.autoFarmStage = { stageId: 'adv_stage', lastCheckedMs }

    gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, -5000)

    expect(player.autoFarmStage!.lastCheckedMs).toBe(lastCheckedMs)
  })

  it('cycleSeconds NaN → no-op (boundedness)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.catalogOps.registerEnemyTemplates([DUMMY])
    gameManager.catalogOps.registerStages([STAGE])
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = NaN
    player.autoFarmStage = { stageId: 'adv_stage', lastCheckedMs: Date.now() - 60_000 }

    expect(() => gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 60)).not.toThrow()
    expect(Number.isFinite(player.autoFarmStage!.lastCheckedMs)).toBe(true)
  })

  it('elapsed Infinity → clamp về cap 24h, KHÔNG vòng lặp vô hạn', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.catalogOps.registerEnemyTemplates([DUMMY])
    gameManager.catalogOps.registerStages([STAGE])
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = 100

    player.autoFarmStage = { stageId: 'adv_stage', lastCheckedMs: Date.now() - 60_000 }

    expect(() => gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, Number.POSITIVE_INFINITY)).not.toThrow()
  })
})

// tickAutoFarm guards cycleSeconds at consumption (isValidCycleSeconds).
// The Mission B round-3 eligibility gate (resolveValidAutoFarmStage,
// shared by startAutoFarm/reconcile) means an armed farm with an invalid
// cycle can no longer be CREATED through either entry — so these tests
// arm a VALID farm then corrupt the cycle, exercising the tick guard as
// the defense-in-depth layer it is.
function buildAutoFarmOps(processDefeatedEnemies: ReturnType<typeof vi.fn>) {
  // The slot mock reproduces real StageManager semantics: a ticking farm
  // must hold the lease OBJECT it acquired (Mission B audit — identity,
  // not stageId), so tests arm it through startAutoFarm rather than
  // hand-setting player.autoFarmStage.
  let active: { stageId: string } | null = null

  const deps = {
    stageManager: {
      getActive: () => active,
      owns: (lease: { stageId: string } | null) => lease !== null && active === lease,
      // Capability API (Mission C): acquire returns the lease object -
      // the ownership token; release frees the slot only for the exact
      // object it still holds.
      acquire: (stage: { id: string }) => {
        if (active !== null) return null
        active = { stageId: stage.id }
        return active
      },
      release: (lease: { stageId: string } | null) => {
        if (lease === null || active !== lease) return false
        active = null
        return true
      },
    },
    stageTemplates: { get: () => STAGE },
    battleLoot: {
      beginBattle: vi.fn(),
      setChannel: vi.fn(),
      setSession: vi.fn(),
      processDefeatedEnemies,
    },
    stageWaves: { pickEnemyForTurnSpawn: () => null },
    enemySystem: { spawn: vi.fn() },
    buildPlayerRewardReceiver: () => ({}),
  } as unknown as ConstructorParameters<typeof GameManagerAutoFarmOps>[0]

  return new GameManagerAutoFarmOps(deps)
}

// Arm the farm through the real entry point so the ops' lease marker
// tracks the acquired slot object — then adjust lastCheckedMs for the
// scenario under test.
function armFarm(ops: GameManagerAutoFarmOps, player: ReturnType<typeof createDefaultPlayer>, lastCheckedMs: number) {
  if (!ops.startAutoFarm(player, 'adv_stage')) {
    throw new Error('armFarm: startAutoFarm refused — harness drift')
  }
  player.autoFarmStage!.lastCheckedMs = lastCheckedMs
}

describe('Adversarial — online auto-farm tick invariants', () => {
  it('rejects cycleSeconds = 0 without rolling reward cycles', () => {
    const processDefeatedEnemies = vi.fn(() => {
      // Safety cap so the buggy path terminates the test instead of hanging:
      // elapsedMs / 0 = Infinity completedCycles, so the loop never stops on
      // its own. A correct implementation rolls ZERO cycles for this state.
      if (processDefeatedEnemies.mock.calls.length > 10) {
        throw new Error('safety cap: loop exceeded 10 iterations')
      }
    })
    const ops = buildAutoFarmOps(processDefeatedEnemies)
    const player = createDefaultPlayer()
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = 100
    armFarm(ops, player, Date.now() - 60_000)
    player.perfectClearSeconds['adv_stage'] = 0 // corrupt post-arm

    expect(() => ops.tickAutoFarm(player)).not.toThrow()
    expect(processDefeatedEnemies.mock.calls.length).toBe(0)
  })

  it('rejects non-finite cycleSeconds without poisoning lastCheckedMs', () => {
    const processDefeatedEnemies = vi.fn()
    const ops = buildAutoFarmOps(processDefeatedEnemies)
    const player = createDefaultPlayer()
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = 100
    armFarm(ops, player, Date.now() - 60_000)
    player.perfectClearSeconds['adv_stage'] = NaN // corrupt post-arm

    ops.tickAutoFarm(player)

    // NaN <= 0 is false, so the loop body is skipped but the poison write
    // `lastCheckedMs += NaN * NaN` still lands: every future tick derives
    // elapsedMs = now - NaN = NaN -> completedCycles NaN -> auto-farm
    // silently stops paying out forever, with no error.
    expect(Number.isFinite(player.autoFarmStage!.lastCheckedMs)).toBe(true)
  })
})

describe('Adversarial — corrupt lastCheckedMs bound (C1)', () => {
  it('small-positive lastCheckedMs settles at most one 24h batch, then converges', () => {
    const processDefeatedEnemies = vi.fn()
    const ops = buildAutoFarmOps(processDefeatedEnemies)
    const player = createDefaultPlayer()
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = 100 // cycle 50s
    // Corrupt save: epoch timestamp. Elapsed is ~55 years -> completedCycles
    // would be ~10^8 without the clamp (pre-fix: main-thread hang).
    armFarm(ops, player, 1)

    ops.tickAutoFarm(player)

    // 24h cap / 50s cycle = 1728 cycles max on the catch-up tick.
    const firstTickRolls = processDefeatedEnemies.mock.calls.length
    expect(firstTickRolls).toBeLessThanOrEqual(24 * 60 * 60 / 50 + 1)
    expect(firstTickRolls).toBeGreaterThan(0)
    expect(Number.isFinite(player.autoFarmStage!.lastCheckedMs)).toBe(true)

    // The clamped window forfeits over-cap time: lastCheckedMs lands at
    // now minus the sub-cycle carry, so the NEXT tick rolls ~0 cycles —
    // not another 24h batch (which would be an infinite per-tick faucet).
    expect(player.autoFarmStage!.lastCheckedMs).toBeGreaterThan(Date.now() - 60_000)

    ops.tickAutoFarm(player)
    expect(processDefeatedEnemies.mock.calls.length).toBe(firstTickRolls)
  })
})
