import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { GameManagerAutoFarmOps } from './GameManagerAutoFarmOps'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'

const DUMMY = defineEnemy({
  id: 'adv_dummy', name: 'Adv Dummy', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 10, attack: 0, attackSpeed: 1, attackRangeRanks: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
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

// tickAutoFarm (ONLINE path) lacks the cycleSeconds guards that
// settleAutoFarmOffline (OFFLINE path) has: the offline path rejects
// `!(cycleSeconds > 0) || !Number.isFinite(cycleSeconds)` up front, the
// online path only checks `undefined`. saveShapeValidation never inspects
// perfectClearSeconds, so a malformed save carries the poison straight
// into the tick loop.
function buildAutoFarmOps(processDefeatedEnemies: ReturnType<typeof vi.fn>) {
  return new GameManagerAutoFarmOps({
    stageManager: { get: () => null, start: () => true, stop: () => {} } as any,
    stageTemplates: { get: () => STAGE } as any,
    battleLoot: {
      beginBattle: vi.fn(),
      setChannel: vi.fn(),
      setSession: vi.fn(),
      processDefeatedEnemies,
    } as any,
    stageWaves: { pickEnemyForTurnSpawn: () => null } as any,
    enemySystem: { spawn: vi.fn() } as any,
    buildPlayerRewardReceiver: () => ({}) as any,
  })
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
    player.perfectClearSeconds['adv_stage'] = 0
    player.autoFarmStage = { stageId: 'adv_stage', lastCheckedMs: Date.now() - 60_000 }

    expect(() => ops.tickAutoFarm(player)).not.toThrow()
    expect(processDefeatedEnemies.mock.calls.length).toBe(0)
  })

  it('rejects non-finite cycleSeconds without poisoning lastCheckedMs', () => {
    const processDefeatedEnemies = vi.fn()
    const ops = buildAutoFarmOps(processDefeatedEnemies)
    const player = createDefaultPlayer()
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = NaN
    player.autoFarmStage = { stageId: 'adv_stage', lastCheckedMs: Date.now() - 60_000 }

    ops.tickAutoFarm(player)

    // NaN <= 0 is false, so the loop body is skipped but the poison write
    // `lastCheckedMs += NaN * NaN` still lands: every future tick derives
    // elapsedMs = now - NaN = NaN -> completedCycles NaN -> auto-farm
    // silently stops paying out forever, with no error.
    expect(Number.isFinite(player.autoFarmStage!.lastCheckedMs)).toBe(true)
  })
})
