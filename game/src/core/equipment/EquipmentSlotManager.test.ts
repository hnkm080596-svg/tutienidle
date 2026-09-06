import { describe, expect, it } from 'vitest'
import type { EquipmentSlot } from './EquipmentTypes'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { createDefaultSlotState, EQUIPMENT_SLOTS } from './EquipmentSlotState'

describe('EquipmentSlotManager', () => {
  it('restore nạp state hợp lệ, slot thiếu trong save giữ nguyên default', () => {
    const manager = new EquipmentSlotManager()
    const weapon = createDefaultSlotState('weapon')
    weapon.enhanceLevel = 5

    manager.restore([weapon])

    expect(manager.get('weapon').enhanceLevel).toBe(5)
    expect(manager.get('helmet').enhanceLevel).toBe(0)
    expect(manager.getAll()).toHaveLength(EQUIPMENT_SLOTS.length)
  })

  // 9.10 defense-in-depth — save data có thể mang slot id lạ (save cũ /
  // lỗi data); restore không được thêm slot mới vào map cố định 6 slot.
  it('restore skip entry có slot không thuộc EQUIPMENT_SLOTS — không throw, không thêm slot mới', () => {
    const manager = new EquipmentSlotManager()
    const weapon = createDefaultSlotState('weapon')
    weapon.enhanceLevel = 3

    const rogue = createDefaultSlotState('weapon')
    rogue.slot = 'khong_hop_le' as EquipmentSlot
    rogue.enhanceLevel = 99

    expect(() => manager.restore([weapon, rogue])).not.toThrow()

    expect(manager.get('weapon').enhanceLevel).toBe(3)
    expect(manager.getAll()).toHaveLength(EQUIPMENT_SLOTS.length)
    expect(manager.getAll().map((state) => state.slot)).toEqual([...EQUIPMENT_SLOTS])
  })
})
