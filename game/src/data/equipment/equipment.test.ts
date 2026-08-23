import { describe, expect, it } from 'vitest'
import { equipment } from './equipment'
import { EQUIPMENT_SLOT_STAT_POLICY } from '@/core/equipment/EquipmentStatPolicy'

describe('equipment data — invariants', () => {
  it('không có id trùng lặp', () => {
    const ids = equipment.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('mọi main stat tuân theo slot policy', () => {
    for (const item of equipment) {
      expect(item.mainStats).toHaveLength(item.slot === 'ring' || item.slot === 'necklace' ? 2 : 1)
      for (const range of item.mainStats) {
        expect(EQUIPMENT_SLOT_STAT_POLICY[item.slot].mainStats).toContain(range.stat)
        expect(range.min).toBeLessThanOrEqual(range.max)
      }
    }
  })

  it('chỉ còn tám base type theo thiết kế', () => {
    expect(equipment.map(item => item.name)).toEqual(['Kiếm', 'Châu', 'Quyền', 'Quán', 'Bào', 'Hài', 'Giới', 'Trụy'])
  })

})
