import { describe, expect, it } from 'vitest'
import {
  MATERIAL_TIER_CONVERSION_RATIO,
  getNextTierMaterialId,
} from './MaterialTierConversionBalance'

describe('MaterialTierConversionBalance — getNextTierMaterialId', () => {
  it('tỉ lệ gộp là 10', () => {
    expect(MATERIAL_TIER_CONVERSION_RATIO).toBe(10)
  })

  it('gỗ lên cảnh giới kế: mortal_wood → qi_refining_wood → foundation_establishment_wood', () => {
    expect(getNextTierMaterialId('mortal_wood')).toBe('qi_refining_wood')
    expect(getNextTierMaterialId('qi_refining_wood')).toBe('foundation_establishment_wood')
  })

  it('gỗ Trúc Cơ là trần → undefined', () => {
    expect(getNextTierMaterialId('foundation_establishment_wood')).toBeUndefined()
  })

  it('quáng lên cảnh giới kế GIỮ PHẨM', () => {
    expect(getNextTierMaterialId('mortal_ore_hoang')).toBe('qi_refining_ore_hoang')
    expect(getNextTierMaterialId('qi_refining_ore_huyen')).toBe('foundation_establishment_ore_huyen')
    expect(getNextTierMaterialId('mortal_ore_tien')).toBe('qi_refining_ore_tien')
  })

  it('quáng Trúc Cơ là trần → undefined', () => {
    expect(getNextTierMaterialId('foundation_establishment_ore_hoang')).toBeUndefined()
    expect(getNextTierMaterialId('foundation_establishment_ore_dia')).toBeUndefined()
  })

  it('biến thể phẩm của gỗ KHÔNG quy đổi → undefined', () => {
    expect(getNextTierMaterialId('mortal_wood_huyen')).toBeUndefined()
    expect(getNextTierMaterialId('qi_refining_wood_tien')).toBeUndefined()
  })

  it('material không phải gỗ/quáng → undefined', () => {
    expect(getNextTierMaterialId('tinh_hoa_pham_the')).toBeUndefined()
    expect(getNextTierMaterialId('spirit_stone_ha_pham')).toBeUndefined()
    expect(getNextTierMaterialId('great_dao_seed')).toBeUndefined()
  })

  it('id quáng thiếu phẩm (kết thúc bằng _ore_) → undefined', () => {
    expect(getNextTierMaterialId('mortal_ore_')).toBeUndefined()
  })
})
