import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { createBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import type { Equipment } from '../equipment/Equipment'

// P2 fix (2026-08-24) — startTribulation() phải reset session loot của
// trận Stage TRƯỚC đó (trước đây chỉ set player, để lại receiver +
// battleRewardSummary stale: getBattleRewardSummary() trả phần thưởng
// cũ của trận Stage vừa rồi sau khi vào Độ Kiếp).
const TEST_EQUIPMENT: Equipment = {
  id: 'tribulation_session_test_sword',
  name: 'Kiếm Thử Session',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'attack', min: 10, max: 20 }],
}

describe('startTribulation — reset session loot của trận Stage trước', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function fightStageAndCollectLoot(gameManager: GameManager, player: ReturnType<typeof createDefaultPlayer>) {
    // rollChance()/randomInt() với Math.random()=0 -> random equipment
    // drop luôn trúng -> summary chắc chắn có item sau khi quái chết.
    const enemy = defineEnemy({
      id: 'stale_session_enemy',
      name: 'Quái Stage',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1, attack: 0, attackSpeed: 1, movementSpeed: 0,
        attackRange: 999999, criticalRate: 0, criticalDamage: 1.5, armor: 0,
      },
      rewards: { techniqueInsight: 5, cultivation: 0, spiritStone: 7 },
    })

    gameManager.startBattleWithPlayer(player, createBaseStats(), enemy)
    gameManager.update(3) // bỏ qua countdown

    const battleEnemy = gameManager.getBattle()!.enemies[0]!
    battleEnemy.entity.currentHp = 0
    battleEnemy.entity.alive = false

    gameManager.update(0.1)

    gameManager.drainNotifications() // dọn toast của trận Stage
  }

  it('battleRewardSummary về RỖNG ngay khi Độ Kiếp bắt đầu', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.registerEquipment([TEST_EQUIPMENT])

    fightStageAndCollectLoot(gameManager, player)

    // Tiền điều kiện: trận Stage đã để lại summary có item (random drop).
    expect(gameManager.getBattleRewardSummary().items.length).toBeGreaterThan(0)

    expect(gameManager.startTribulation(player, createBaseStats(), 'qi_refining')).toBe(true)

    const summary = gameManager.getBattleRewardSummary()

    expect(summary.items).toHaveLength(0)
    expect(summary.techniqueInsight).toBe(0)
    expect(summary.skillInsight).toBe(0)
    expect(summary.spiritStone).toBe(0)
  })

  it('không có loot mới phát sinh sau khi vào Độ Kiếp (receiver đã bị xoá)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.registerEquipment([TEST_EQUIPMENT])

    fightStageAndCollectLoot(gameManager, player)

    const bagAfterStage = gameManager.equipmentBag.getAll().length
    expect(bagAfterStage).toBeGreaterThan(0)

    expect(gameManager.startTribulation(player, createBaseStats(), 'qi_refining')).toBe(true)

    gameManager.update(0.1) // 1 tick trong trận Kiếp

    expect(gameManager.equipmentBag.getAll()).toHaveLength(bagAfterStage)
    expect(
      gameManager.drainNotifications().filter(event => event.kind === 'loot'),
    ).toHaveLength(0)
  })
})
