import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'

// Combat Art Pipeline spec §7 addendum (2026-09-05) — effectiveTotalEnemyCount()
// khiến GameManager.buildTurnBattle()'s wave config KHÔNG BAO GIỜ cho phép quái
// thường trộn cùng Boss, kể cả khi content data (stage.totalEnemyCount) khai sai.
describe('boss stage — GameManager.buildTurnBattle wave config never allows a regular enemy alongside the boss', () => {
  it('a floor-10 boss stage with totalEnemyCount:5 in its content data still only ever has 1 enemy total', () => {
    const gameManager = new GameManager()

    const bossTemplate = defineEnemy({
      id: 'test_boss_solo', name: 'Test Boss', level: 1, realmId: 'mortal', lane: 'ground', isBoss: true,
      statsInput: { maxHp: 1000, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const regularTemplate = defineEnemy({
      id: 'test_regular_should_not_spawn', name: 'Regular', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 1, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    const stage: Stage = {
      id: 'boss_solo_stage', name: 'Boss Solo Stage', description: '',
      floor: 10, bossEnemyId: 'test_boss_solo',
      enemyPool: [{ enemyId: 'test_regular_should_not_spawn', weight: 1 }],
      totalEnemyCount: 5, // content author mistake — should still be forced to 1 effectively
      spawnIntervalSeconds: 0,
    }

    gameManager.registerEnemyTemplates([bossTemplate, regularTemplate])
    gameManager.registerStages([stage])

    const player = createDefaultPlayer()
    const stats = calculateStats(player.baseStats, [])

    gameManager.setActivePlayer(player)

    expect(gameManager.startStage(player, stats, stage, false)).toBe(true)

    expect(gameManager.getTurnBattle()!.wave?.totalEnemyCount).toBe(1)
  })
})
