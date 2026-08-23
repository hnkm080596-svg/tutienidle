import { describe, expect, it } from 'vitest'
import { qualityRank, phamRank } from './normalizeSlotRank'

describe('normalizeSlotRank', () => {
  it('qualityRank ánh xạ 9 bậc Quality 1:1 vào rank 1-9', () => {
    expect(qualityRank('pham_khi')).toBe(1)
    expect(qualityRank('phap_bao')).toBe(5)
    expect(qualityRank('thien_dia_trong_khi')).toBe(9)
  })

  it('phamRank ánh xạ 5 bậc Phẩm đều vào rank 1-3-5-7-9', () => {
    expect(phamRank('hoang_pham')).toBe(1)
    expect(phamRank('huyen_pham')).toBe(3)
    expect(phamRank('dia_pham')).toBe(5)
    expect(phamRank('thien_pham')).toBe(7)
    expect(phamRank('tien_pham')).toBe(9)
  })
})
