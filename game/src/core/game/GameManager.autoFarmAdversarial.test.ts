import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
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
    gameManager.registerEnemyTemplates([DUMMY])
    gameManager.registerStages([STAGE])
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = 100 // cycle 50s

    const lastCheckedMs = Date.now() - 120_000
    player.autoFarmStage = { stageId: 'adv_stage', lastCheckedMs }

    // Settle 120s = 2 cycles (50s mỗi cycle) + 20s dư → lastCheckedMs tiến 100s.
    gameManager.settleAutoFarmOffline(player, 120)
    const afterFirst = player.autoFarmStage!.lastCheckedMs

    expect(afterFirst).toBeGreaterThanOrEqual(lastCheckedMs + 100_000 - 1000)
    expect(afterFirst).toBeLessThanOrEqual(lastCheckedMs + 100_000 + 1000)
  })

  it('elapsed ÂM (clock rollback) → no-op, lastCheckedMs KHÔNG lùi', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.registerEnemyTemplates([DUMMY])
    gameManager.registerStages([STAGE])
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = 100

    const lastCheckedMs = Date.now() - 10_000
    player.autoFarmStage = { stageId: 'adv_stage', lastCheckedMs }

    gameManager.settleAutoFarmOffline(player, -5000)

    expect(player.autoFarmStage!.lastCheckedMs).toBe(lastCheckedMs)
  })

  it('cycleSeconds NaN → no-op (boundedness)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.registerEnemyTemplates([DUMMY])
    gameManager.registerStages([STAGE])
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = NaN
    player.autoFarmStage = { stageId: 'adv_stage', lastCheckedMs: Date.now() - 60_000 }

    expect(() => gameManager.settleAutoFarmOffline(player, 60)).not.toThrow()
    expect(Number.isFinite(player.autoFarmStage!.lastCheckedMs)).toBe(true)
  })

  it('elapsed Infinity → clamp về cap 24h, KHÔNG vòng lặp vô hạn', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.registerEnemyTemplates([DUMMY])
    gameManager.registerStages([STAGE])
    player.perfectClearStageIds.push('adv_stage')
    player.perfectClearSeconds['adv_stage'] = 100

    player.autoFarmStage = { stageId: 'adv_stage', lastCheckedMs: Date.now() - 60_000 }

    expect(() => gameManager.settleAutoFarmOffline(player, Number.POSITIVE_INFINITY)).not.toThrow()
  })
})
