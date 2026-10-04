import { describe, expect, it } from 'vitest'
import { buildTieredPills } from '@/data/pill/pills'
import { MAIN_STAT_KEYS } from '@/core/stats/StatTypes'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import {
  THANH_VAN_GROTTO_HERB_BASES,
  THANH_VAN_GROTTO_HERBS,
} from '@/core/production/ProductionCatalog'
import { isPillFamilyRecipeLiveAtRealm, PILL_FAMILIES } from '@/data/pill/PillFamilies'

describe('Đan dược 9 phẩm', () => {
  it('chỉ có đúng 8 loại, mỗi loại có 9 phẩm runtime', () => {
    const pills = buildTieredPills()
    expect(PILL_FAMILIES).toHaveLength(8)
    expect(pills).toHaveLength(72)
    expect(new Set(pills.map(pill => pill.name))).toHaveLength(8)
  })

  // 2026-09-29 ruling: permanent_stat writes baseStats, which only the
  // 5 main stats may occupy meaningfully - a non-main stat here would
  // bypass the cap gate's semantics and the hidden predicate alike.
  it('mọi effect permanent_stat được author đều target một Main Stat', () => {
    for (const pill of buildTieredPills()) {
      for (const effect of pill.effects) {
        if (effect.type === 'permanent_stat') {
          expect(MAIN_STAT_KEYS).toContain(effect.stat)
        }
      }
    }
  })

  it('nối đủ 8 linh thảo tương ứng vào recipe; Động Thiên chỉ nuôi họ chưa retire', () => {
    // Identity data stays resolvable for every family (retired included).
    for (const family of PILL_FAMILIES) {
      expect(alchemyRecipes.some(recipe => recipe.pillId === `${family.id}_mortal`)).toBe(true)
    }

    // QI-D8 - the live grotto pool only grows families whose recipe is
    // live at that realm (Hoi Xuan Thao fully deferred; Hoi Linh Thao is
    // also realm-retired at mortal - its mp_regen recipe is a dead craft
    // while spell stats stay 0, so the pool stops minting orphan herbs;
    // shared predicate in PillFamilies).
    const mortalLiveFamilies = PILL_FAMILIES.filter((family) => isPillFamilyRecipeLiveAtRealm(family, 'mortal'))

    for (const family of mortalLiveFamilies) {
      expect(THANH_VAN_GROTTO_HERB_BASES.some(herb => herb.baseId === `${family.herbId}_mortal`)).toBe(true)
    }

    // The pool spans every Thanh Van realm, and hoi_linh is live at all
    // non-mortal realms - so the distinct herb-name count is families live
    // at ANY territory realm, not just mortal.
    const anyRealmLiveFamilies = PILL_FAMILIES.filter((family) =>
      THANH_VAN_GROTTO_HERB_BASES.some(
        (herb) => herb.baseId.startsWith(`${family.herbId}_`),
      ),
    )
    expect(anyRealmLiveFamilies).toHaveLength(7)
    expect(new Set(THANH_VAN_GROTTO_HERB_BASES.map((herb) => herb.name))).toHaveLength(anyRealmLiveFamilies.length)

    expect(THANH_VAN_GROTTO_HERB_BASES.some((herb) => herb.baseId.startsWith('hoi_xuan_thao_'))).toBe(false)
    expect(THANH_VAN_GROTTO_HERBS.some((herb) => herb.materialId.startsWith('hoi_xuan_thao_'))).toBe(false)
  })
})
