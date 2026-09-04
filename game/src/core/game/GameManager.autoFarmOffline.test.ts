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
  totalEnemyCount: 2,
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
    player.autoFarmStage = {
      stageId: 'farm_stage',
      lastCheckedMs: Date.now() - 10_000,
    }

    gameManager.settleAutoFarmOffline(player, 10)

    expect(player.autoFarmStage?.lastCheckedMs).toBe(Date.now() - 10_000)
  })
})
