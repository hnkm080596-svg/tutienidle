import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { createBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import type { Equipment } from '../equipment/Equipment'

// Uncommitted audit followup plan, mục "Đồng nhất thông báo trang bị rơi
// ngẫu nhiên" (2026-08-24) — đường "rớt đồ NGẪU NHIÊN" giờ là pool entry
// 'equipment_any' trong stage table (drop-system 2026-09-12): resolver
// chọn nó, grantResolvedDrops rút template từ equipmentRegistry. Toast
// 'loot' phải đi kèm bag + battle summary đúng 1 lần mỗi món.
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
    // rng 0.8: guaranteed tinh_hoa (0.7) trượt; pool roll 0.8*35=28 trên
    // bảng mortal -> qua base_kiem (w15) -> rơi vào equipment_any (w20)
    // -> randomInt(0.8) chọn index 0 = template test duy nhất.
    vi.spyOn(Math, 'random').mockReturnValue(0.8)

    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
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
        maxHp: 1, attack: 0, attackSpeed: 1,
        attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0,
      },
      // KHÔNG khai signatureDrops — cô lập đúng đường equipment_any của
      // stage pool (quái thường = 1 pool draw → đúng 1 món).
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    gameManager.startBattleWithPlayer(player, stats, enemy)
    combatSource.advance(3) // bỏ qua countdown 3s trước trận

    // Giết quái trực tiếp — không cần chờ player tự đánh (không equip
    // skill nào trong test này), grantBattleRewardIfNeeded() chỉ đọc
    // battleEnemy.entity.alive.
    const battleEnemy = gameManager.getTurnBattle()!.enemies[0]!
    battleEnemy.entity.currentHp = 0
    battleEnemy.entity.alive = false

    combatSource.advance(COMBAT_STEP_SECONDS)

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
