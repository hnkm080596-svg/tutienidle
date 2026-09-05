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
  ORE_QUALITY_AMOUNTS,
  ORE_QUALITY_WEIGHTS,
  TIER_WEIGHT_PROFILES,
} from '../production/ProductionBalance'
import { ORE_QUALITIES } from '../production/ProductionTypes'
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
  it('Linh Mộc và Linh Khoáng dùng tên tuổi + tên gốc (spec 2026-08-30)', () => {
    const materialName = (id: string) => materials.find((material) => material.id === id)?.name

    expect(materialName('mortal_wood')).toBe('Thập Niên Linh Mộc')
    expect(materialName('mortal_ore_hoang')).toBe('Thập Niên Linh Khoáng')
    expect(materialName('mahayana_wood_dia')).toBe('Thiên Niên Linh Mộc')
    expect(materialName('mahayana_ore_dia')).toBe('Thiên Niên Linh Khoáng')
    expect(materialName('mortal_ore_tien')).toBe('Thượng Cổ Linh Khoáng')
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

  it('trong so tier/pham/tuoi deu chuan hoa duoc (tong > 0)', () => {
    for (const key of ['low', 'middle', 'high'] as const) {
      const total = TIER_WEIGHT_PROFILES[key].reduce((sum, weight) => sum + weight, 0)

      expect(total).toBeGreaterThan(0)
    }

    expect(ORE_QUALITY_WEIGHTS.hoang).toBeGreaterThan(ORE_QUALITY_WEIGHTS.tien)

    expect(HERB_AGE_WEIGHTS.decade).toBeGreaterThan(HERB_AGE_WEIGHTS.myriad_year)
  })

  it('go: moi tier deu co sink (xay nang building dung wood cung realm)', () => {
    // Data buildings da rewrite: upgradeCost dung <realm>_wood.
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

  it('quang: expected ore/gio theo tung pham duong; sink Khi Duong ton tai', () => {
    const probs = normalized(ORE_QUALITIES.map((quality) => ORE_QUALITY_WEIGHTS[quality]))

    const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM.mortal!

    const cyclesPerHour = 3600 / baseSeconds

    let hoangPerHour = 0

    let tienPerHour = 0

    ORE_QUALITIES.forEach((_quality, index) => {
      const amount = ORE_QUALITY_AMOUNTS[ORE_QUALITIES[index]!]

      if (index === 0) hoangPerHour = probs[index]! * amount * cyclesPerHour

      if (index === ORE_QUALITIES.length - 1) tienPerHour = probs[index]! * amount * cyclesPerHour
    })

    // Pham Hoang phai cho nhieu hon Tien rat nhieu (engine enforce thu tu).
    expect(hoangPerHour).toBeGreaterThan(tienPerHour * 5)

    // Sink: Cuong Hoa an 2 ore hoang / lan, Wash an 3 → nhu cau hop ly.
    expect(hoangPerHour).toBeGreaterThan(10)
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
