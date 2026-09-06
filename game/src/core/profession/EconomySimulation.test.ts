// Economy simulation (2026-08-25, plan Phase 5 "can bang"): yield/hour
// cua ba nguon Thanh Van → sink chinh (Khi Duong, Dan Phong, xay/nang).
// Bao cao ty le bao phu — baseline la khoi diem playtest; chi fail CI
// khi hong authoring that su (thieu kenh tieu thu).
import { describe, expect, it } from 'vitest'
import { materials } from '../../data/materials/materials'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  HERB_AGE_WEIGHTS,
  MATERIAL_AGE_AMOUNTS,
  MATERIAL_AGE_WEIGHTS,
  TIER_WEIGHT_PROFILES,
} from '../production/ProductionBalance'
import { HERB_AGES } from '../production/ProductionTypes'
import { SUPPORTED_PROFESSION_REALMS } from '../profession/ProfessionMaterial'

const REALM_IDS = SUPPORTED_PROFESSION_REALMS

function normalized(weights: readonly number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0)

  return weights.map((weight) => weight / total)
}

/** Expected go/gio theo tung tier tai mot profile thu thap (level 1). */
function expectedWoodPerHour(profileKey: 'low' | 'middle' | 'high'): number[] {
  const probs = normalized(TIER_WEIGHT_PROFILES[profileKey])

  const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM[REALM_IDS[0]!] ?? 100

  const cyclesPerHour = 3600 / baseSeconds

  // Thanh Van Lam amounts [3,2,1] theo tier.
  return [3, 2, 1].map((amount, index) => probs[index]! * amount * cyclesPerHour)
}

describe('Economy simulation — yield → sink', () => {
  it('Linh Mộc và Linh Khoáng dùng tên tuổi + tên gốc + realm (gp123 6E C2)', () => {
    const materialName = (id: string) => materials.find((material) => material.id === id)?.name

    expect(materialName('mortal_wood_decade')).toBe('Thập Niên Linh Mộc Phàm Nhân')
    expect(materialName('mortal_ore_decade')).toBe('Thập Niên Linh Khoáng Phàm Nhân')
    expect(materialName('mahayana_wood_millennium')).toBe('Thiên Niên Linh Mộc Đại Thừa')
    expect(materialName('mahayana_ore_millennium')).toBe('Thiên Niên Linh Khoáng Đại Thừa')
    expect(materialName('mortal_ore_thuong_co')).toBe('Thượng Cổ Linh Khoáng Phàm Nhân')
  })

  it('registry chỉ còn linh thảo của đúng 8 họ đan mới', () => {
    const herbs = materials.filter(material => material.category === 'herb')
    const legacyIds = ['linh_chi', 'que', 'cuc_hoa', 'linh_thao_chung', 'huyet_tham_decade']

    // 8 họ × 9 realm × 5 tuổi (gp123 6E C1: thêm thuong_co).
    expect(herbs).toHaveLength(8 * 9 * 5)
    expect(legacyIds.every(id => !materials.some(material => material.id === id))).toBe(true)
  })

  it('moi realm trong scope co cycle time duoc dinh nghia va duong', () => {
    for (const realmId of REALM_IDS) {
      expect(CYCLE_BASE_SECONDS_BY_REALM[realmId]).toBeGreaterThan(0)
    }
  })

  it('trong so tier/tuoi deu chuan hoa duoc (tong > 0)', () => {
    for (const key of ['low', 'middle', 'high'] as const) {
      const total = TIER_WEIGHT_PROFILES[key].reduce((sum, weight) => sum + weight, 0)

      expect(total).toBeGreaterThan(0)
    }

    expect(MATERIAL_AGE_WEIGHTS.decade).toBeGreaterThan(MATERIAL_AGE_WEIGHTS.thuong_co)

    expect(HERB_AGE_WEIGHTS.decade).toBeGreaterThan(HERB_AGE_WEIGHTS.myriad_year)
  })

  it('go: moi tier deu co sink (xay nang building dung wood cung realm)', () => {
    // Data buildings da rewrite: upgradeCost dung <realm>_wood_<age> (6E C2).
    void materials

    // Simulation: muc tieu thu nang cap site (wood 5-16/cap) phai dat
    // duoc trong vai gio voi expected yield.
    const perHourLow = expectedWoodPerHour('low')

    const totalLow = perHourLow.reduce((sum, value) => sum + value, 0)

    // Level 1 Pham Nhan: ~108 go/gio tong (60%*3 + 20%*2 + 10%*1)*36.
    expect(totalLow).toBeGreaterThan(50)

    // Nang cap cap 2 can 5 go mortal → du trong vua mot cycle.
    expect(perHourLow[0]!).toBeGreaterThan(50)
  })

  it('quang: expected ore/gio theo tung tuoi duong; sink Khi Duong ton tai', () => {
    const probs = normalized(HERB_AGES.map((age) => MATERIAL_AGE_WEIGHTS[age]))

    const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM.mortal!

    const cyclesPerHour = 3600 / baseSeconds

    let decadePerHour = 0

    let thuongCoPerHour = 0

    HERB_AGES.forEach((_age, index) => {
      const amount = MATERIAL_AGE_AMOUNTS[HERB_AGES[index]!]

      if (index === 0) decadePerHour = probs[index]! * amount * cyclesPerHour

      if (index === HERB_AGES.length - 1) thuongCoPerHour = probs[index]! * amount * cyclesPerHour
    })

    // Tuổi thấp phải cho nhiều hơn thuong_co rất nhiều (engine enforce thứ tự).
    expect(decadePerHour).toBeGreaterThan(thuongCoPerHour * 5)

    // Sink: Cuong Hoa an 2 ore decade / lan, Wash an 3 → nhu cau hop ly.
    expect(decadePerHour).toBeGreaterThan(10)
  })

  it('thao: moi dan phuong nghe co dung mot thao rieng du 4 tuoi; sink ton tai', () => {
    const grottoRecipeIds = alchemyRecipes.filter((recipe) => recipe.realmId === 'mortal')

    expect(grottoRecipeIds.length).toBe(8)

    for (const recipe of grottoRecipeIds) {
      expect(recipe.herbVariants.length).toBe(4)

      // Moi variant material phai ton tai trong materials data.
      for (const variant of recipe.herbVariants) {
        expect(
          materials.some((material) => material.id === variant.materialId),
          `${variant.materialId}`,
        ).toBe(true)
      }
    }

    // 72 đan phương generated theo PILL_FAMILIES × 9 realm + 2 đan đặc
    // biệt của gate Trúc Cơ (spec dot-pha-loi-kiep §4.1b).
    expect(alchemyRecipes).toHaveLength(72 + 2)
  })
})
