import { describe, expect, it } from 'vitest'
import { getSpiritStoneMaterialIdForEnhanceLevel, getSpiritStoneMaterialIdForRealmTier } from './SpiritStoneMaterial'

describe('Linh Thạch phân phẩm', () => {
  it('chọn phẩm theo ba bracket cảnh giới', () => {
    expect(getSpiritStoneMaterialIdForRealmTier(1)).toBe('spirit_stone_ha_pham')
    expect(getSpiritStoneMaterialIdForRealmTier(4)).toBe('spirit_stone_trung_pham')
    expect(getSpiritStoneMaterialIdForRealmTier(7)).toBe('spirit_stone_thuong_pham')
  })

  it('Cường Hóa đổi phẩm sau mỗi 30 cấp', () => {
    expect(getSpiritStoneMaterialIdForEnhanceLevel(29)).toBe('spirit_stone_ha_pham')
    expect(getSpiritStoneMaterialIdForEnhanceLevel(30)).toBe('spirit_stone_trung_pham')
    expect(getSpiritStoneMaterialIdForEnhanceLevel(60)).toBe('spirit_stone_thuong_pham')
  })
})
