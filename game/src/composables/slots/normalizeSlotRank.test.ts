import { describe, expect, it } from 'vitest'
import { isMaxRankTone, itemQualityRank, professionGradeRank } from './normalizeSlotRank'

describe('normalizeSlotRank', () => {
  it('itemQualityRank ánh xạ 5 bậc Phẩm Chất 1:1 vào rank 1-5 (dải riêng, không rải 1-3-5-7-9)', () => {
    expect(itemQualityRank('hoang')).toBe(1)
    expect(itemQualityRank('huyen')).toBe(2)
    expect(itemQualityRank('dia')).toBe(3)
    expect(itemQualityRank('thien')).toBe(4)
    expect(itemQualityRank('tien')).toBe(5)
  })

  it('professionGradeRank ánh xạ 10 bậc Phẩm Nghề 1:1 vào rank 1-10, KHÔNG clamp về 9', () => {
    expect(professionGradeRank('cuu_pham')).toBe(1)
    expect(professionGradeRank('ngu_pham')).toBe(5)
    expect(professionGradeRank('nhat_pham')).toBe(9)
    expect(professionGradeRank('tien_pham')).toBe(10)
  })

  it('isMaxRankTone: true cho bậc cao nhất của CẢ 2 trục qua rank max riêng', () => {
    expect(isMaxRankTone('tien')).toBe(true)
    expect(isMaxRankTone('tien_pham')).toBe(true)
  })

  it('isMaxRankTone: false cho bậc không phải cao nhất, hoặc tone rỗng/không rõ nguồn', () => {
    expect(isMaxRankTone('hoang')).toBe(false)
    expect(isMaxRankTone('cuu_pham')).toBe(false)
    expect(isMaxRankTone(undefined)).toBe(false)
    expect(isMaxRankTone('unknown_tone')).toBe(false)
  })
})
