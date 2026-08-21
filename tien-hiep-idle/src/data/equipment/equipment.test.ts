import { describe, expect, it } from 'vitest'
import { equipment } from './equipment'
import { equipmentSets } from './equipmentSets'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'

const ALL_SLOTS: EquipmentSlot[] = ['weapon', 'helmet', 'armor', 'boots', 'ring', 'necklace']

describe('equipment data — invariants', () => {
  it('không có id trùng lặp', () => {
    const ids = equipment.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('mỗi Equipment.setId (nếu có) phải khớp 1 EquipmentSet đã đăng ký', () => {
    const setIds = new Set(equipmentSets.map(set => set.id))

    for (const item of equipment) {
      if (item.setId) {
        expect(setIds.has(item.setId)).toBe(true)
      }
    }
  })

  it('mỗi Set đã đăng ký (equipmentSets) có ĐÚNG 6 vật phẩm khớp đủ 6 EquipmentSlot, không trùng slot', () => {
    for (const set of equipmentSets) {
      const items = equipment.filter(item => item.setId === set.id)

      expect(items).toHaveLength(6)
      expect(new Set(items.map(item => item.slot)).size).toBe(6)
      expect(items.map(item => item.slot).sort()).toEqual([...ALL_SLOTS].sort())
    }
  })

  it('mỗi EquipmentSet có ĐÚNG 3 mốc bonus 2/4/6 món', () => {
    for (const set of equipmentSets) {
      expect(set.bonuses.map(bonus => bonus.pieces).sort((a, b) => a - b)).toEqual([2, 4, 6])
    }
  })
})
