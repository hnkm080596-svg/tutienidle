import { describe, expect, it } from 'vitest'
import { buildTieredPills } from '@/data/pill/pills'
import { clampToRealmCap } from './PillSystem'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import {
  THANH_VAN_GROTTO_HERB_BASES,
  THANH_VAN_GROTTO_HERBS,
} from '@/core/production/ProductionCatalog'
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

  it('nối đủ 8 linh thảo tương ứng vào recipe; Động Thiên chỉ nuôi họ chưa retire', () => {
    // Identity data stays resolvable for every family (retired included).
    for (const family of PILL_FAMILIES) {
      expect(alchemyRecipes.some(recipe => recipe.pillId === `${family.id}_mortal`)).toBe(true)
    }

    // QI-D8 - the live grotto pool only grows non-retired families
    // (Hoi Xuan Thao is deferred: identity kept, generation pruned).
    const liveFamilies = PILL_FAMILIES.filter((family) => family.retired !== true)

    for (const family of liveFamilies) {
      expect(THANH_VAN_GROTTO_HERB_BASES.some(herb => herb.baseId === `${family.herbId}_mortal`)).toBe(true)
    }

    expect(new Set(THANH_VAN_GROTTO_HERB_BASES.map((herb) => herb.name))).toHaveLength(liveFamilies.length)

    expect(THANH_VAN_GROTTO_HERB_BASES.some((herb) => herb.baseId.startsWith('hoi_xuan_thao_'))).toBe(false)
    expect(THANH_VAN_GROTTO_HERBS.some((herb) => herb.materialId.startsWith('hoi_xuan_thao_'))).toBe(false)
  })
})
