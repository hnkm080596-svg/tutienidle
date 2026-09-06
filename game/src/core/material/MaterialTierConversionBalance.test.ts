import { describe, expect, it } from 'vitest'
import {
  MATERIAL_TIER_CONVERSION_RATIO,
  getNextTierMaterialId,
} from './MaterialTierConversionBalance'

describe('MaterialTierConversionBalance — getNextTierMaterialId', () => {
  it('tỉ lệ gộp là 10', () => {
    expect(MATERIAL_TIER_CONVERSION_RATIO).toBe(10)
  })

  it('gỗ lên cảnh giới kế GIỮ TUỔI (gp123 6E C2: id theo trục tuổi)', () => {
    expect(getNextTierMaterialId('mortal_wood_decade')).toBe('qi_refining_wood_decade')
    expect(getNextTierMaterialId('qi_refining_wood_decade')).toBe(
      'foundation_establishment_wood_decade',
    )
    expect(getNextTierMaterialId('mortal_wood_century')).toBe('qi_refining_wood_century')
  })

  it('gỗ Trúc Cơ là trần → undefined', () => {
    expect(getNextTierMaterialId('foundation_establishment_wood_decade')).toBeUndefined()
    expect(getNextTierMaterialId('foundation_establishment_wood_thuong_co')).toBeUndefined()
  })

  it('quáng lên cảnh giới kế GIỮ TUỔI', () => {
    expect(getNextTierMaterialId('mortal_ore_decade')).toBe('qi_refining_ore_decade')
    expect(getNextTierMaterialId('qi_refining_ore_century')).toBe('foundation_establishment_ore_century')
    expect(getNextTierMaterialId('mortal_ore_thuong_co')).toBe('qi_refining_ore_thuong_co')
  })

  it('quáng Trúc Cơ là trần → undefined', () => {
    expect(getNextTierMaterialId('foundation_establishment_ore_decade')).toBeUndefined()
    expect(getNextTierMaterialId('foundation_establishment_ore_millennium')).toBeUndefined()
  })

  it('id gỗ/khoáng sai age (không thuộc trục tuổi) → undefined', () => {
    expect(getNextTierMaterialId('mortal_wood_huyen')).toBeUndefined()
    expect(getNextTierMaterialId('qi_refining_ore_tien')).toBeUndefined()
    expect(getNextTierMaterialId('mortal_wood')).toBeUndefined()
  })

  it('material không phải gỗ/quáng → undefined', () => {
    expect(getNextTierMaterialId('tinh_hoa_pham_the')).toBeUndefined()
    expect(getNextTierMaterialId('spirit_stone_ha_pham')).toBeUndefined()
    expect(getNextTierMaterialId('great_dao_seed')).toBeUndefined()
  })

  it('id quáng thiếu age (kết thúc bằng _ore_) → undefined', () => {
    expect(getNextTierMaterialId('mortal_ore_')).toBeUndefined()
  })
})
