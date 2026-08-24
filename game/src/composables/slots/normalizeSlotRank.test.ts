import { describe, expect, it } from 'vitest'
import { equipmentQualityRank, itemGradeRank } from './normalizeSlotRank'

describe('normalizeSlotRank', () => {
  it('equipmentQualityRank ánh xạ 9 bậc Quality 1:1 vào rank 1-9', () => {
    expect(equipmentQualityRank('pham_khi')).toBe(1)
    expect(equipmentQualityRank('phap_bao')).toBe(5)
    expect(equipmentQualityRank('thien_dia_trong_khi')).toBe(9)
  })

  it('itemGradeRank ánh xạ 5 bậc Phẩm đều vào rank 1-3-5-7-9', () => {
    expect(itemGradeRank('hoang')).toBe(1)
    expect(itemGradeRank('huyen')).toBe(3)
    expect(itemGradeRank('dia')).toBe(5)
    expect(itemGradeRank('thien')).toBe(7)
    expect(itemGradeRank('tien')).toBe(9)
  })
})
