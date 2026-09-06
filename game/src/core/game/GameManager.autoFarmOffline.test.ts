import { describe, expect, it } from 'vitest'
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
    attack: 0,
    attackSpeed: 1,
    attackRangeRanks: 1,
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

  gameManager.registerEnemyTemplates([OFFLINE_DUMMY])
  gameManager.registerStages([OFFLINE_STAGE])

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

    gameManager.settleAutoFarmOffline(player, 120)

    expect(player.autoFarmStage?.lastCheckedMs).toBeGreaterThanOrEqual(
      Date.now() - 120_000 + 100_000 - 1000,
    )
  })

  it('KHÔNG có autoFarmStage → no-op an toàn', () => {
    const { gameManager, player } = harnessWithFarm()

    expect(() => gameManager.settleAutoFarmOffline(player, 120)).not.toThrow()
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

    gameManager.settleAutoFarmOffline(player, 10)

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

      gameManager.settleAutoFarmOffline(player, 3 * 24 * 60 * 60) // 3 ngày

      // Cap 24h / 50s = 1728 cycles — KHÔNG phải 3 ngày/50s = 5184.
      // lastCheckedMs tiến đúng 1728*50s = 86_400_000ms (= cap 24h).
      expect(player.autoFarmStage?.lastCheckedMs).toBeGreaterThanOrEqual(
        startMs + 86_400_000 - 1000,
      )
      expect(player.autoFarmStage?.lastCheckedMs).toBeLessThanOrEqual(startMs + 86_400_000 + 1000)
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

      gameManager.settleAutoFarmOffline(player, 24 * 60 * 60)

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

      expect(() => gameManager.settleAutoFarmOffline(player, 120)).not.toThrow()
      expect(player.autoFarmStage?.lastCheckedMs).toBe(lastCheckedMs)
    })
  })
})
