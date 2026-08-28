import { describe, expect, it } from 'vitest'
import { buildTieredPills } from '@/data/pill/pills'
import { clampToRealmCap } from './PillSystem'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import { THANH_VAN_GROTTO_HERB_BASES } from '@/core/production/ProductionCatalog'
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'

describe('Đan dược 9 phẩm', () => {
  it('chỉ có đúng 8 loại, mỗi loại có 9 phẩm runtime', () => {
    const pills = buildTieredPills()
    expect(PILL_FAMILIES).toHaveLength(8)
    expect(pills).toHaveLength(72)
    expect(new Set(pills.map(pill => pill.name))).toHaveLength(8)
  })

  it('clamp bonus vĩnh viễn theo trần cảnh giới', () => {
    expect(clampToRealmCap(9, 4, 'mortal')).toBe(1)
    expect(clampToRealmCap(10, 4, 'mortal')).toBe(0)
  })

  it('nối đủ 8 linh thảo tương ứng vào recipe và Động Thiên Thanh Vân', () => {
    for (const family of PILL_FAMILIES) {
      expect(alchemyRecipes.some(recipe => recipe.pillId === `${family.id}_mortal`)).toBe(true)
      expect(THANH_VAN_GROTTO_HERB_BASES.some(herb => herb.baseId === `${family.herbId}_mortal`)).toBe(true)
    }

    expect(new Set(THANH_VAN_GROTTO_HERB_BASES.map((herb) => herb.name))).toHaveLength(8)
  })
})
