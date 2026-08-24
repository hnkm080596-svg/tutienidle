import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { createBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'

// skill-insight-and-auto-combat-hud-plan.md mục 3/11 — Cảm ngộ Kỹ năng
// (skillInsight) LUÔN cấp khi hạ quái, KHÔNG cần trang bị tâm pháp
// (khác Cảm ngộ Tâm Pháp/techniqueInsight), và chỉ cấp đúng 1 lần cho
// mỗi con quái chết dù nhiều tick cùng xử lý (guard rewardGranted).
function makeEnemy(techniqueInsight: number) {
  return defineEnemy({
    id: 'skill_insight_test_enemy',
    name: 'Quái',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1, attack: 0, attackSpeed: 1, movementSpeed: 0,
      attackRange: 999999, criticalRate: 0, criticalDamage: 1.5, armor: 0,
    },
    rewards: { techniqueInsight, cultivation: 0, spiritStone: 0 },
  })
}

describe('GameManager — Cảm ngộ Kỹ năng khi hạ quái', () => {
  it('KHÔNG trang bị tâm pháp vẫn nhận skillInsight', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = createBaseStats()

    // Không techniqueManager.equip() gì cả — cố ý không có tâm pháp.
    gameManager.startBattleWithPlayer(player, stats, makeEnemy(10))
    gameManager.update(3) // bỏ qua countdown

    const battleEnemy = gameManager.getBattle()!.enemies[0]!
    battleEnemy.entity.currentHp = 0
    battleEnemy.entity.alive = false

    gameManager.update(0.1)

    expect(player.skillInsight).toBeGreaterThan(0)
    expect(player.totalSkillInsightGained).toBe(player.skillInsight)
    expect(gameManager.getBattleRewardSummary().skillInsight).toBe(player.skillInsight)
  })

  it('chỉ cấp skillInsight đúng 1 lần dù nhiều tick cùng xử lý quái chết', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = createBaseStats()

    gameManager.startBattleWithPlayer(player, stats, makeEnemy(10))
    gameManager.update(3)

    const battleEnemy = gameManager.getBattle()!.enemies[0]!
    battleEnemy.entity.currentHp = 0
    battleEnemy.entity.alive = false

    gameManager.update(0.1)
    const afterFirstTick = player.skillInsight

    gameManager.update(0.1)
    gameManager.update(0.1)

    expect(player.skillInsight).toBe(afterFirstTick)
  })
})
