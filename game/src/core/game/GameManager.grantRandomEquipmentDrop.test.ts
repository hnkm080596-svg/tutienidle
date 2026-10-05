import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import type { Equipment } from '../equipment/Equipment'

// Uncommitted audit followup plan, muc "Dong nhat thong bao trang bi roi
// ngau nhien" (2026-08-24) - duong "rot do NGAU NHIEN" gio la pool entry
// 'equipment_any' trong stage table (drop-system 2026-09-12): resolver
// chon no, grantResolvedDrops rut template tu equipmentRegistry. Toast
// 'loot' phai di kem bag + battle summary dung 1 lan moi mon.
const TEST_EQUIPMENT: Equipment = {
  id: 'random_drop_test_sword',
  name: 'Kiếm',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'might', min: 10, max: 20 }],
}

describe('GameManager.grantRandomEquipmentDrop — toast đồng nhất với grantItemDrops', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('bag, battle summary và loot notification chỉ cộng đúng 1 lần khi quái chết', () => {
    // Loot rng scripted qua setLootRng (Math.random van 0.8 cho combat
    // rolls): call dau 0.8 -> guaranteed tinh_hoa (0.7) truot; pool draw
    // 0.1 -> roll 0.1 * (20 + 113.33) ~= 13 roi vung hit 15% cua bang
    // mortal da gate (poolDrawChance 0.15) -> equipment_any ->
    // randomInt(0.1) chon index 0 = template test duy nhat.
    vi.spyOn(Math, 'random').mockReturnValue(0.8)

    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()

    gameManager.catalogOps.registerEquipment([TEST_EQUIPMENT])

    const enemy = defineEnemy({
      id: 'random_drop_test_enemy',
      name: 'Quái',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1, might: 0, attackSpeed: 1,
        criticalRate: 0, criticalDamage: 1.5, armor: 0,
      },
      // KHONG khai signatureDrops - co lap dung duong equipment_any cua
      // stage pool (quai thuong = 1 pool draw -> dung 1 mon).
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })

    let lootCalls = 0
    gameManager.setLootRng(() => (lootCalls++ === 0 ? 0.8 : 0.1))

    gameManager.startBattleWithPlayer(player, enemy)
    combatSource.advance(3) // bo qua countdown 3s truoc tran

    // Giet quai truc tiep - khong can cho player tu danh (khong equip
    // skill nao trong test nay), grantBattleRewardIfNeeded() chi doc
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
