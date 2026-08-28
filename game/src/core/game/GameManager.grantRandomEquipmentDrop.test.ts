import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { createBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import type { Equipment } from '../equipment/Equipment'

// Uncommitted audit followup plan, mục "Đồng nhất thông báo trang bị rơi
// ngẫu nhiên" (2026-08-24) — grantRandomEquipmentDrop() (rớt đồ NGẪU
// NHIÊN theo BOSS/NORMAL_EQUIPMENT_DROP_CHANCE, tách biệt hoàn toàn với
// enemy.rewards.itemDrops) trước đây thiếu pushLootNotification() so với
// nhánh 'equipment' của grantItemDrops() — bag/particle/battle summary vẫn
// cộng đúng nhưng KHÔNG có toast báo cho người chơi biết vừa rớt đồ.
const TEST_EQUIPMENT: Equipment = {
  id: 'random_drop_test_sword',
  name: 'Kiếm',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'attack', min: 10, max: 20 }],
}

describe('GameManager.grantRandomEquipmentDrop — toast đồng nhất với grantItemDrops', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('bag, battle summary và loot notification chỉ cộng đúng 1 lần khi quái chết', () => {
    // rollChance() dùng Math.random() < chance -> 0 luôn trúng mọi
    // chance > 0. randomInt() cũng dùng Math.random() -> luôn chọn
    // phần tử đầu tiên trong pool (chỉ có đúng 1 template ở đây).
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = createBaseStats()

    gameManager.registerEquipment([TEST_EQUIPMENT])

    const enemy = defineEnemy({
      id: 'random_drop_test_enemy',
      name: 'Quái',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1, attack: 0, attackSpeed: 1, movementSpeed: 0,
        attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0,
      },
      // KHÔNG khai itemDrops — cô lập đúng nhánh grantRandomEquipmentDrop(),
      // không lẫn với grantItemDrops()'s nhánh 'equipment'.
      rewards: { techniqueInsight: 0, spiritStone: 0 },
      isBoss: true, // BOSS_EQUIPMENT_DROP_CHANCE = 0.3, roll=0 luôn trúng.
    })

    gameManager.startBattleWithPlayer(player, stats, enemy)
    gameManager.update(3) // bỏ qua countdown 3s trước trận

    // Giết quái trực tiếp — không cần chờ player tự đánh (không equip
    // skill nào trong test này), grantBattleRewardIfNeeded() chỉ đọc
    // battleEnemy.entity.alive.
    const battleEnemy = gameManager.getBattle()!.enemies[0]!
    battleEnemy.entity.currentHp = 0
    battleEnemy.entity.alive = false

    gameManager.update(0.1)

    expect(gameManager.equipmentBag.getAll()).toHaveLength(1)

    const equipmentRewardItems = gameManager.getBattleRewardSummary().items
      .filter(item => item.kind === 'equipment')
    expect(equipmentRewardItems).toHaveLength(1)
    expect(equipmentRewardItems[0]!.amount).toBe(1)

    const lootToasts = gameManager.drainNotifications()
      .filter(event => event.kind === 'loot' && event.loot)
    expect(lootToasts).toHaveLength(1)
    expect(lootToasts[0]!.message).toContain(TEST_EQUIPMENT.name)
  })
})
