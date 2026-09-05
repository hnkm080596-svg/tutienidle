// Data-integrity gate (2026-08-25, plan §3/§5/§6): dữ liệu nghề THẬT
// trong repo (materials.ts + ProductionCatalog + alchemyRecipes) phải
// khớp nhau — lỗi authoring bị bắt ngay tại test.
import { describe, expect, it } from 'vitest'
import { materials } from '../../data/materials/materials'
import { HERB_AGE_WEIGHTS } from '../production/ProductionBalance'
import { HERB_AGES } from '../production/ProductionTypes'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_GROTTO_HERB_BASES,
  THANH_VAN_GROTTO_HERBS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_PRODUCTION_SITES,
  validateTerritory,
  validateWeightOrdering,
} from '../production/ProductionCatalog'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { pills } from '../../data/pill/pills'
import { PILL_FAMILIES } from '../../data/pill/PillFamilies'
import { REALM_TIERS } from '../realm/RealmTierMap'
import {
  validateProfessionMaterialCatalog,
  validateProfessionMaterialEntry,
} from './ProfessionValidators'

describe('Du lieu nghe that trong repo (data-integrity gate)', () => {
  const professionMaterials = materials.filter((material) => material.profession)

  it('moi material co meta nghe pass entry validator (id khop convention)', () => {
    for (const material of professionMaterials) {
      expect(
        validateProfessionMaterialEntry(material.id, material.profession!),
        `${material.id}`,
      ).toBeNull()
    }
  })

  it('catalog day du: 3 go / 15 quang / thao du 4 tuoi x 12 dan phuong', () => {
    const result = validateProfessionMaterialCatalog(professionMaterials)

    expect(result.errors).toEqual([])
  })

  // gp123 6E (task C1): trục tuổi thống nhất 5 bậc — thuong_co là bậc
  // trên cùng của Linh Thảo, dùng chung bảng nhãn chất (Thượng Cổ).
  it('HERB_AGES du 5 bac ket thuc bang thuong_co', () => {
    expect(HERB_AGES).toEqual(['decade', 'century', 'millennium', 'myriad_year', 'thuong_co'])
  })

  it('trong so tuoi thao giam dan: decade > ... > thuong_co', () => {
    for (let index = 1; index < HERB_AGES.length; index++) {
      const previous = HERB_AGE_WEIGHTS[HERB_AGES[index - 1]!]

      const current = HERB_AGE_WEIGHTS[HERB_AGES[index]!]

      expect(current).toBeLessThan(previous)
    }

    expect(HERB_AGE_WEIGHTS.thuong_co).toBe(2)
  })

  it('thao sinh du 5 bien the tuoi moi ho dan; ten dung nhan Thuong Co', () => {
    for (const family of PILL_FAMILIES) {
      for (const realmId of REALM_TIERS) {
        for (const age of HERB_AGES) {
          const id = `${family.herbId}_${realmId}_${age}`

          const material = materials.find((entry) => entry.id === id)

          expect(material, id).toBeDefined()

          expect(material!.years).toBeGreaterThan(0)
        }
      }
    }

    const herbId = PILL_FAMILIES[0]!.herbId

    const herbName = PILL_FAMILIES[0]!.herbName

    // Nhãn tuổi theo bảng nhãn chất thống nhất (Thập Niên..Thượng Cổ) —
    // không nhãn nào được tra ra undefined (regression guard).
    const expectedNames: Record<string, string> = {
      decade: 'Thập Niên',
      century: 'Bách Niên',
      millennium: 'Thiên Niên',
      myriad_year: 'Vạn Niên',
      thuong_co: 'Thượng Cổ',
    }

    for (const age of HERB_AGES) {
      const material = materials.find((entry) => entry.id === `${herbId}_mortal_${age}`)

      expect(material!.name).toBe(`${expectedNames[age]} ${herbName}`)
    }

    const thuongCo = materials.find((entry) => entry.id === `${herbId}_mortal_thuong_co`)

    expect(thuongCo!.icon).toBe(`/assets/materials/herbs/${herbId}/thuong_co.png`)
  })

  it('Dia Gioi Thanh Van hop le: dung 1 Lam/Quang/Dong Thien + rewards phu 3 tier', () => {
    const result = validateTerritory(
      TERRITORY_THANH_VAN,
      THANH_VAN_PRODUCTION_SITES,
      THANH_VAN_FOREST_REWARDS,
      THANH_VAN_MINE_REWARDS,
      THANH_VAN_GROTTO_HERBS,
    )

    expect(result.errors).toEqual([])
  })

  it('trong so pham Quang/nien dai giam dan tuyet doi', () => {
    expect(validateWeightOrdering()).toEqual([])
  })

  it('moi dan phuong co DUNG MOT thao rieng; mapping data ↔ catalog khop (§6.1)', () => {
    const byRecipe = new Map<string, Set<string>>()

    for (const base of THANH_VAN_GROTTO_HERB_BASES) {
      const identities = byRecipe.get(base.pillRecipeId) ?? new Set<string>()

      identities.add(base.baseId)

      byRecipe.set(base.pillRecipeId, identities)
    }

    // Mỗi đan phương đúng một identity thảo.
    for (const [, identities] of byRecipe) {
      expect(identities.size).toBe(1)
    }

    // Mọi recipeId catalog khai báo đều tồn tại trong data alchemy.
    const recipeIds = new Set(alchemyRecipes.map((recipe) => recipe.id))

    for (const [recipeId] of byRecipe) {
      expect(recipeIds.has(recipeId), `catalog khai bao ${recipeId} nhung data thieu`).toBe(true)
    }

    // Data alchemy recipe herbVariants khớp material id sinh ở generator.
    for (const base of THANH_VAN_GROTTO_HERB_BASES) {
      const recipe = alchemyRecipes.find((candidate) => candidate.id === base.pillRecipeId)

      expect(recipe).toBeDefined()

      for (const variant of recipe!.herbVariants) {
        expect(variant.materialId.startsWith(`${base.baseId}_`)).toBe(true)

        expect(materials.some((material) => material.id === variant.materialId)).toBe(true)
      }
    }
  })

  it('moi linh thao, linh moc va linh khoang co icon dung quy uoc', () => {
    for (const material of materials) {
      if (material.category === 'herb') {
        expect(material.icon).toMatch(
          /^\/assets\/materials\/herbs\/.+\/(decade|century|millennium|myriad_year|thuong_co)\.png$/,
        )
      } else if (material.category === 'wood') {
        expect(material.icon).toBe('/assets/materials/linh_moc.png')
      } else if (material.category === 'ore') {
        expect(material.icon).toBe('/assets/materials/linh_khoang.png')
      }
    }
  })

  it('moi pham cua cung mot ho dan dung chung mot icon', () => {
    for (const family of PILL_FAMILIES) {
      const familyPills = pills.filter((pill) => pill.id.startsWith(`${family.id}_`))

      expect(familyPills).toHaveLength(REALM_TIERS.length)
      expect(new Set(familyPills.map((pill) => pill.icon))).toEqual(
        new Set([`/assets/pills/${family.id}.png`]),
      )
    }
  })
})
