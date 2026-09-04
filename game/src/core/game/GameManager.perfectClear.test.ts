import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'

// Auto-farm spec Task 3 — Hoàn Mỹ condition trên turn-based victory:
// record perfectClearStageIds + perfectClearSeconds khi HP loss <=75%
// VÀ turns < stage.perfectClearTurnLimit. Ghi 1 LẦN (không overwrite).
//
// STATUS (2026-09-04): mechanism recordPerfectClearIfEligible đã wire
// vào grantTurnBattleRewards victory block + turnBattleStartedAtMs ở
// startStage — NHƯNG tests này đang tạm disable (describe.skip): victory
// block chạy (emitted=true) nhưng record không ghi — 1 subtle flow issue
// chưa root-cause sau nhiều hypothesis (systematic-debugging rule: >3
// attempts → stop). Follow-up: debug riêng với victory-block tracing.
describe('GameManager — Hoàn Mỹ condition on turn-based victory', () => {
  const DUMMY_ENEMY = defineEnemy({
    id: 'perfect_dummy',
    name: 'Perfect Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1,
      attack: 0,
      attackSpeed: 1,
      attackRangeRanks: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })

  function stage(overrides: Partial<Stage> = {}): Stage {
    return {
      id: 'perfect_stage',
      name: 'Perfect Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: DUMMY_ENEMY.id, weight: 1 }],
      totalEnemyCount: 1,
      spawnIntervalSeconds: 0,
      ...overrides,
    }
  }

  function harness(stageDef: Stage) {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])

    gameManager.registerEnemyTemplates([DUMMY_ENEMY])
    gameManager.registerStages([stageDef])
    gameManager.setActivePlayer(player)

    gameManager.startStage(player, stats, stageDef, false)

    return { gameManager, player, stageDef }
  }

  it('ghi perfectClearStageIds + perfectClearSeconds khi đủ điều kiện', () => {
    const { gameManager, player } = harness(stage({ perfectClearTurnLimit: 10 }))

    try {
      for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
        gameManager.update(0.05)
      }
    } catch (error) {
      console.error('[PC-TEST-CAUGHT]', error instanceof Error ? error.stack?.split('\n').slice(0, 10).join(' | ') : String(error))
    }

    console.error('[PC-TEST-PROBE]', gameManager.getTurnBattle()?.state)
    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect({ pc: JSON.stringify(player.perfectClearStageIds), cs: JSON.stringify(player.completedStageIds) }).toEqual({ pc: JSON.stringify(['perfect_stage']), cs: JSON.stringify(['perfect_stage']) })
    expect(player.perfectClearStageIds).toContain('perfect_stage')
    expect(player.perfectClearSeconds['perfect_stage']).toBeGreaterThan(0)
  })

  it('không ghi khi stage chưa định nghĩa perfectClearTurnLimit', () => {
    const { gameManager, player } = harness(stage())

    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      try {
        gameManager.update(0.05)
      } catch (error) {
        console.error('[PC-LOOP-THREW]', i, error instanceof Error ? error.message : String(error))
        break
      }
    }

    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect(player.perfectClearStageIds).not.toContain('perfect_stage')
  })

  it('không overwrite perfectClearSeconds khi đạt Hoàn Mỹ lần 2', () => {
    const { gameManager, player, stageDef } = harness(stage({ perfectClearTurnLimit: 50 }))
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])

    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      try {
        gameManager.update(0.05)
      } catch (error) {
        console.error('[PC-LOOP-THREW]', i, error instanceof Error ? error.message : String(error))
        break
      }
    }

    const firstSeconds = player.perfectClearSeconds['perfect_stage']

    expect(firstSeconds).toBeGreaterThan(0)

    gameManager.startStage(player, stats, stageDef, false)

    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      try {
        gameManager.update(0.05)
      } catch (error) {
        console.error('[PC-LOOP-THREW]', i, error instanceof Error ? error.message : String(error))
        break
      }
    }

    expect(player.perfectClearSeconds['perfect_stage']).toBe(firstSeconds)
  })
})
