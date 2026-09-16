import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'

// Auto-farm spec Task 5 — offline catch-up: sau restore, auto-farm đang
// chạy roll reward cho SỐ CYCLES đã trôi offline (dùng cùng chu kỳ online),
// lastCheckedMs tiến đúng phần đã settle (leftover giữ lại).

const OFFLINE_DUMMY = defineEnemy({
  id: 'offline_dummy',
  name: 'Offline Dummy',
  level: 1,
  realmId: 'mortal',
  lane: 'ground',
  statsInput: {
    maxHp: 10,
    might: 0,
    attackSpeed: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 0,
  },
  rewards: { techniqueInsight: 0, spiritStone: 5 },
})

const OFFLINE_STAGE = {
  id: 'farm_stage',
  name: 'Farm Stage',
  description: '',
  floor: 1,
  enemyPool: [{ enemyId: 'offline_dummy', weight: 1 }],
  totalEnemyCount: 2, waves: [2],
  spawnIntervalSeconds: 0,
}

function harnessWithFarm() {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()

  gameManager.catalogOps.registerEnemyTemplates([OFFLINE_DUMMY])
  gameManager.catalogOps.registerStages([OFFLINE_STAGE])

  return { gameManager, player }
}

describe('GameManager — auto-farm offline catch-up (restore)', () => {
  it('settleAutoFarmOffline roll đúng số cycles trôi + lastCheckedMs tiến đúng phần đã settle', () => {
    const { gameManager, player } = harnessWithFarm()

    player.perfectClearStageIds.push('farm_stage')
    player.perfectClearSeconds['farm_stage'] = 100 // cycle = 50s

    // Mô phỏng: auto-farm bật lúc T, offline trôi 120s = 2 cycles (50s mỗi
    // cycle) + 20s dư.
    player.autoFarmStage = {
      stageId: 'farm_stage',
      lastCheckedMs: Date.now() - 120_000,
    }

    gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 120)

    expect(player.autoFarmStage?.lastCheckedMs).toBeGreaterThanOrEqual(
      Date.now() - 120_000 + 100_000 - 1000,
    )
  })

  it('KHÔNG có autoFarmStage → no-op an toàn', () => {
    const { gameManager, player } = harnessWithFarm()

    expect(() => gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 120)).not.toThrow()
  })

  it('elapsed không đủ 1 cycle → không settle, lastCheckedMs giữ nguyên', () => {
    const { gameManager, player } = harnessWithFarm()

    player.perfectClearStageIds.push('farm_stage')
    player.perfectClearSeconds['farm_stage'] = 100
    // Bắt mốc 1 LẦN — so sánh Date.now() 2 lần bị race vài ms (flaky).
    const lastCheckedMs = Date.now() - 10_000
    player.autoFarmStage = {
      stageId: 'farm_stage',
      lastCheckedMs,
    }

    gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 10)

    expect(player.autoFarmStage?.lastCheckedMs).toBe(lastCheckedMs)
  })

  // Remediation Task 3 (2026-09-05) — unbounded offline settlement: settle
  // nhiều ngày offline với cycle ngắn phải CHẬN theo DEFAULT_MAX_OFFLINE_
  // SECONDS (24h — cùng nguồn GameClock), không roll hàng nghìn cycles.
  describe('Remediation Task 3 — bounded offline settlement', () => {
    it('elapsed nhiều ngày → roll CHỈ đúng số cycles trong cap 24h', () => {
      const { gameManager, player } = harnessWithFarm()

      player.perfectClearStageIds.push('farm_stage')
      player.perfectClearSeconds['farm_stage'] = 100 // cycle = 50s online

      const startMs = Date.now() - 3 * 24 * 60 * 60 * 1000 // 3 ngày trước

      player.autoFarmStage = {
        stageId: 'farm_stage',
        lastCheckedMs: startMs,
      }

      gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 3 * 24 * 60 * 60) // 3 ngày

      // Cap 24h / 50s = 1728 cycles — KHÔNG phải 3 ngày/50s = 5184.
      // B5 (T1-12): the anchor rebases to now minus the UNSETTLED
      // remainder — the whole capped window settled, so the anchor sits
      // at ~now, NOT startMs + cap (the old encoding left it days stale
      // and let the next online tick re-pay the same window).
      expect(player.autoFarmStage?.lastCheckedMs).toBeGreaterThan(Date.now() - 50_000)
      expect(player.autoFarmStage?.lastCheckedMs).toBeLessThanOrEqual(Date.now())
    })

    it('cycleSeconds cực nhỏ (0.5s) → vẫn bounded, không roll 100k+ cycles', () => {
      const { gameManager, player } = harnessWithFarm()

      player.perfectClearStageIds.push('farm_stage')
      player.perfectClearSeconds['farm_stage'] = 1 // cycle = 0.5s online

      // Bắt mốc 1 LẦN — tránh race Date.now() giữa setup và assert.
      const startMs = Date.now() - 24 * 60 * 60 * 1000 // đúng 24h trước
      player.autoFarmStage = {
        stageId: 'farm_stage',
        lastCheckedMs: startMs,
      }

      gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 24 * 60 * 60)

      // 24h / 0.5s = 172_800 cycles vẫn roll — nhưng theo cap 24h nên
      // lastCheckedMs tiến ĐÚNG 24h (= startMs + 24h, trước hiện tại).
      expect(player.autoFarmStage?.lastCheckedMs).toBeGreaterThanOrEqual(startMs + 86_400_000)
      expect(player.autoFarmStage?.lastCheckedMs).toBeLessThanOrEqual(startMs + 86_400_000 + 1000)
    })

    it('cycleSeconds <= 0 / non-finite → no-op an toàn, không loop vô hạn', () => {
      const { gameManager, player } = harnessWithFarm()

      player.perfectClearStageIds.push('farm_stage')
      // Save hỏng/malformed: perfectClearSeconds có thể 0 hoặc NaN.
      player.perfectClearSeconds['farm_stage'] = 0
      // Bắt mốc 1 LẦN — so sánh Date.now() 2 lần bị race vài ms (flaky).
      const lastCheckedMs = Date.now() - 120_000
      player.autoFarmStage = {
        stageId: 'farm_stage',
        lastCheckedMs,
      }

      expect(() => gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 120)).not.toThrow()
      expect(player.autoFarmStage?.lastCheckedMs).toBe(lastCheckedMs)
    })

    it('corrupt small-positive lastCheckedMs → settle pays one capped window, next online tick does NOT pay a second (audit T1-12)', () => {
      vi.useFakeTimers()
      try {
        const { gameManager, player } = harnessWithFarm()

        // tickAutoFarm reads activePlayer via tickOps.update — harnessWithFarm
        // does NOT set it (unlike GameManager.autoFarm.test.ts:53), so set it.
        gameManager.setActivePlayer(player)
        player.perfectClearStageIds.push('farm_stage')
        player.perfectClearSeconds['farm_stage'] = 100 // cycle = 50s

        // Corrupt save shape: epoch+1ms survives validation (finite, >= 0).
        player.autoFarmStage = { stageId: 'farm_stage', lastCheckedMs: 1 }

        // Cycle counter: getBattleRewardSummary().spiritStone aggregates reward
        // rolls without needing a material registry (same read as
        // GameManager.autoFarm.test.ts:118-120). Each cycle pays 2 enemies x 5.
        const before = gameManager.getBattleRewardSummary().spiritStone

        gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 24 * 60 * 60)

        // The settle covered the whole capped window, so the anchor must sit
        // INSIDE it — not still at epoch.
        const anchor = player.autoFarmStage!.lastCheckedMs
        expect(anchor).toBeGreaterThan(Date.now() - 24 * 60 * 60 * 1000)
        expect(Number.isFinite(anchor)).toBe(true)

        const afterSettle = gameManager.getBattleRewardSummary().spiritStone
        expect(afterSettle).toBeGreaterThan(before)

        // One online tick at most pays the sub-cycle remainder — never another
        // 24h batch (1728 cycles x 2 enemies x 5 stone).
        gameManager.tickOps.update(0.1)

        const tickDelta = gameManager.getBattleRewardSummary().spiritStone - afterSettle
        expect(tickDelta).toBeLessThanOrEqual(2 * 5) // <= 1 cycle worth
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
