import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
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
      maxHp: 1, might: 0, attackSpeed: 1,
      attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0,
    },
    rewards: { techniqueInsight, spiritStone: 0 },
  })
}

describe('GameManager — Cảm ngộ Kỹ năng khi hạ quái', () => {
  it('KHÔNG trang bị tâm pháp vẫn nhận skillInsight', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()

    // Không techniqueManager.equip() gì cả — cố ý không có tâm pháp.
    gameManager.startBattleWithPlayer(player, makeEnemy(10))
    combatSource.advance(3) // bỏ qua countdown

    const battleEnemy = gameManager.getTurnBattle()!.enemies[0]!
    battleEnemy.entity.currentHp = 0
    battleEnemy.entity.alive = false

    combatSource.advance(COMBAT_STEP_SECONDS)

    expect(player.skillInsight).toBeGreaterThan(0)
    expect(player.totalSkillInsightGained).toBe(player.skillInsight)
    expect(gameManager.getBattleRewardSummary().skillInsight).toBe(player.skillInsight)
  })

  it('chỉ cấp skillInsight đúng 1 lần dù nhiều tick cùng xử lý quái chết', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()

    gameManager.startBattleWithPlayer(player, makeEnemy(10))
    combatSource.advance(3)

    const battleEnemy = gameManager.getTurnBattle()!.enemies[0]!
    battleEnemy.entity.currentHp = 0
    battleEnemy.entity.alive = false

    combatSource.advance(COMBAT_STEP_SECONDS)
    const afterFirstTick = player.skillInsight

    combatSource.advance(COMBAT_STEP_SECONDS)
    combatSource.advance(COMBAT_STEP_SECONDS)

    expect(player.skillInsight).toBe(afterFirstTick)
  })
})
