import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { makeInstance } from '../equipment/EquipmentInstance.fixture'

// Task 17 (rework P5) — unequipAllEquipment() tháo TOÀN BỘ trang bị đang
// mặc (để tránh kẹt đồ lệch phẩm sau breakthrough, xem Task 16 gate) —
// slot state (enhanceLevel/enhanceFailStreak) PHẢI giữ nguyên, chỉ đổi
// equipped flag + modifier sync.
describe('GameManager — unequipAllEquipment() (rework P5, Task 17)', () => {
  it('mọi instance đang equipped → equipped=false sau khi gọi', () => {
    const manager = new GameManager()

    const weapon = makeInstance({ instanceId: 'unequip-all-weapon', slot: 'weapon', equipped: true })
    const helmet = makeInstance({ instanceId: 'unequip-all-helmet', slot: 'helmet', equipped: true })
    const unequippedRing = makeInstance({ instanceId: 'unequip-all-ring', slot: 'ring', equipped: false })

    manager.equipmentBag.add(weapon)
    manager.equipmentBag.add(helmet)
    manager.equipmentBag.add(unequippedRing)

    manager.unequipAllEquipment()

    expect(weapon.equipped).toBe(false)
    expect(helmet.equipped).toBe(false)
    expect(unequippedRing.equipped).toBe(false)
    expect(manager.equipmentBag.getEquipped()).toHaveLength(0)
  })

  it('modifier equipment sync về rỗng sau unequip-all', () => {
    const manager = new GameManager()

    const weapon = makeInstance({ instanceId: 'unequip-all-mod-weapon', slot: 'weapon', equipped: true })
    manager.equipmentBag.add(weapon)

    // equip() thật để modifierSystem nội bộ của EquipmentSystem có dữ liệu
    // (add() ở trên chỉ nạp instance vào bag, KHÔNG tự apply modifier).
    manager.equipmentSystem.refreshModifiers(
      manager.equipmentBag,
      manager.equipmentSlotManager,
      manager.affixRegistry,
    )
    expect(manager.getEquipmentModifiers().length).toBeGreaterThan(0)

    manager.unequipAllEquipment()

    expect(manager.getEquipmentModifiers()).toHaveLength(0)
  })

  it('GIỮ NGUYÊN enhanceLevel/enhanceFailStreak của slot state — không reset', () => {
    const manager = new GameManager()

    const weapon = makeInstance({ instanceId: 'unequip-all-enhance-weapon', slot: 'weapon', equipped: true })
    manager.equipmentBag.add(weapon)

    manager.equipmentSlotManager.restore([
      { ...manager.equipmentSlotManager.get('weapon'), enhanceLevel: 5, enhanceFailStreak: 3 },
    ])

    manager.unequipAllEquipment()

    const slotState = manager.equipmentSlotManager.get('weapon')
    expect(slotState.enhanceLevel).toBe(5)
    expect(slotState.enhanceFailStreak).toBe(3)
  })

  it('không có item nào equipped → không throw, no-op an toàn', () => {
    const manager = new GameManager()

    expect(() => manager.unequipAllEquipment()).not.toThrow()
    expect(manager.equipmentBag.getEquipped()).toHaveLength(0)
  })
})
