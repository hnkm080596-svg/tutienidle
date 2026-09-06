import { describe, expect, it } from 'vitest'
import {
  VENDOR_BYPRODUCT_PRICE_BASE,
  VENDOR_ESSENCE_PRICE_BASE,
  VENDOR_REALM_GROWTH,
  VENDOR_SELLABLE_CATEGORIES,
  getUnitSellPrice,
} from './VendorBalance'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import {
  SPIRIT_STONE_MATERIAL,
  SPIRIT_STONE_MATERIAL_ID,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID,
  SPIRIT_STONE_THUONG_PHAM_MATERIAL,
  SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID,
} from '../material/SpiritStoneMaterial'
import type { Material } from '../material/Material'
import type { AlchemyRecipe } from '../alchemy/AlchemySystem'
import type { HerbAge } from '../production/ProductionTypes'
import { VendorSystem } from './VendorSystem'
import { REALM_TIERS } from '../realm/RealmTierMap'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'

function herb(id: string, age: HerbAge, realmId = 'mortal'): Material {
  return {
    id,

    name: id,

    category: 'herb',

    sourceType: 'exploration',

    profession: {
      resourceKind: 'herb',

      realmId,

      age,

      pillRecipeId: `alchemy_test_${realmId}`,

      herbBaseId: `test_herb_${realmId}`,
    },
  }
}

function wood(id: string, realmId: string, age: HerbAge): Material {
  return {
    id,

    name: id,

    category: 'wood',

    sourceType: 'exploration',

    profession: { resourceKind: 'wood', realmId, age },
  }
}

function ore(id: string, realmId: string, age: HerbAge): Material {
  return {
    id,

    name: id,

    category: 'ore',

    sourceType: 'exploration',

    profession: { resourceKind: 'ore', realmId, age },
  }
}

function byproduct(id: string, realmId: string): Material {
  return {
    id,

    name: id,

    category: 'byproduct',

    sourceType: 'building',

    profession: { resourceKind: 'wood', realmId, age: 'decade' },
  }
}

describe('VendorBalance — bảng giá Hóa Bán', () => {
  it('VENDOR_REALM_GROWTH = 3, danh mục bán được đúng spec', () => {
    expect(VENDOR_REALM_GROWTH).toBe(3)
    expect(VENDOR_ESSENCE_PRICE_BASE).toBe(5)
    expect(VENDOR_BYPRODUCT_PRICE_BASE).toBe(1)
    expect(VENDOR_SELLABLE_CATEGORIES).toEqual([
      'herb',
      'wood',
      'ore',
      'essence',
      'byproduct',
    ])
  })

  it('herb — tuổi càng cao giá càng cao (đơn vị hạ tương đương)', () => {
    const realmId = 'mortal'

    expect(getUnitSellPrice(herb('h_decade', 'decade'), realmId)).toBe(2)
    expect(getUnitSellPrice(herb('h_century', 'century'), realmId)).toBe(4)
    expect(getUnitSellPrice(herb('h_millennium', 'millennium'), realmId)).toBe(8)
    expect(getUnitSellPrice(herb('h_myriad', 'myriad_year'), realmId)).toBe(16)
  })

  it('herb — realm tier của material quyết định giá, không phụ thuộc realm truyền vào', () => {
    const decade = herb('h_decade_qr', 'decade', 'qi_refining')

    expect(getUnitSellPrice(decade, 'qi_refining')).toBe(2 * 3)
    expect(getUnitSellPrice(decade, 'mortal')).toBe(2 * 3)
  })

  it('wood — bảng theo tuổi, nhân realmGrowth theo realm của material (gp123 6E C2)', () => {
    expect(getUnitSellPrice(wood('w_decade', 'mortal', 'decade'), 'mortal')).toBe(2)
    expect(getUnitSellPrice(wood('w_century', 'mortal', 'century'), 'mortal')).toBe(5)
    expect(getUnitSellPrice(wood('w_millennium', 'mortal', 'millennium'), 'mortal')).toBe(12)
    expect(getUnitSellPrice(wood('w_myriad', 'mortal', 'myriad_year'), 'mortal')).toBe(30)
    expect(getUnitSellPrice(wood('w_thuong_co', 'mortal', 'thuong_co'), 'mortal')).toBe(75)
    expect(getUnitSellPrice(wood('w_decade_qr', 'qi_refining', 'decade'), 'qi_refining')).toBe(6)
  })

  it('ore — bảng theo tuổi, nhân realmGrowth theo realm của material (gp123 6E C2)', () => {
    expect(getUnitSellPrice(ore('o_decade', 'mortal', 'decade'), 'mortal')).toBe(3)
    expect(getUnitSellPrice(ore('o_century', 'mortal', 'century'), 'mortal')).toBe(8)
    expect(getUnitSellPrice(ore('o_millennium', 'mortal', 'millennium'), 'mortal')).toBe(20)
    expect(getUnitSellPrice(ore('o_myriad', 'mortal', 'myriad_year'), 'mortal')).toBe(50)
    expect(getUnitSellPrice(ore('o_thuong_co', 'mortal', 'thuong_co'), 'mortal')).toBe(120)
  })

  it('Luyện Khí Tinh Hoa — giá theo index realm của bối cảnh bán', () => {
    const realms = [
      'mortal',
      'qi_refining',
      'foundation_establishment',
      'golden_core',
      'nascent_soul',
      'soul_transformation',
      'void_refinement',
      'mahayana',
      'body_integration',
      'tribulation',
    ]

    for (const realmId of realms) {
      const index = realms.indexOf(realmId)

      expect(getUnitSellPrice(
        {
          id: LUYEN_KHI_TINH_HOA_ID,
          name: 'essence',
          category: 'essence',
          sourceType: 'building',
        },
        realmId,
      )).toBe(5 * Math.pow(3, index))
    }
  })

  it('byproduct — giá nền 1 × realmGrowth theo realm của meta', () => {
    expect(getUnitSellPrice(byproduct('bp_1', 'mortal'), 'mortal')).toBe(1)
    expect(getUnitSellPrice(byproduct('bp_2', 'qi_refining'), 'mortal')).toBe(3)
  })

  it('Linh Thạch KHÔNG bán được', () => {
    expect(getUnitSellPrice(SPIRIT_STONE_MATERIAL, 'mortal')).toBeUndefined()
  })

  it('herb thiếu meta nghề → undefined', () => {
    const bareHerb: Material = {
      id: 'bare_herb',
      name: 'bare',
      category: 'herb',
      sourceType: 'exploration',
    }

    expect(getUnitSellPrice(bareHerb, 'mortal')).toBeUndefined()
  })
})

function makeRecipe(
  id: string,
  herbMaterialIds: readonly string[],
): AlchemyRecipe {
  return {
    id,

    pillId: `pill_${id}`,

    realmId: 'mortal',

    herbVariants: herbMaterialIds.map((materialId) => ({
      materialId,

      age: 'decade' as const,

      label: 'Thập Niên',
    })),

    herbAmount: 1,

    fuelWoodRealmId: 'mortal',

    fuelWoodAmount: 1,

    spiritStoneCost: 10,

    baseDurationSeconds: 10,
  }
}

function setupVendor(extraMaterials: readonly Material[] = [], recipes: readonly AlchemyRecipe[] = []) {
  const registry = new MaterialRegistry()

  const materials = [
    SPIRIT_STONE_MATERIAL,
    SPIRIT_STONE_TRUNG_PHAM_MATERIAL,
    SPIRIT_STONE_THUONG_PHAM_MATERIAL,
    herb('herb_a_decade', 'decade'),
    herb('herb_b_decade', 'decade'),
    herb('herb_a_century', 'century'),
    ...extraMaterials,
  ]

  for (const material of materials) {
    registry.register(material)
  }

  const vendor = new VendorSystem(registry, recipes)

  const bag = new MaterialBag()

  return { vendor, bag, registry }
}

describe('VendorSystem — Hóa Bán (economy-fixes-sinks-plan §3.2 B2)', () => {
  it('atomic round trip: bán herb hạ — trừ nguyên liệu, cộng đúng số Linh Thạch', () => {
    const { vendor, bag, registry } = setupVendor()

    bag.add(registry.get('herb_a_decade'), 10)
    bag.add(SPIRIT_STONE_MATERIAL, 100)

    const result = vendor.sellMaterial(bag, 'herb_a_decade', 10, 'mortal')

    expect(result.ok).toBe(true)
    expect(result.gained).toBe(20)
    expect(bag.getAmount('herb_a_decade')).toBe(0)
    expect(bag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(120)
  })

  it('không đủ số lượng → từ chối với invalid_amount, KHÔNG trừ gì', () => {
    const { vendor, bag } = setupVendor()

    bag.add(SPIRIT_STONE_MATERIAL, 100)

    const result = vendor.sellMaterial(bag, 'herb_a_decade', 5, 'mortal')

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('invalid_amount')
    expect(bag.getAmount('herb_a_decade')).toBe(0)
    expect(bag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(100)
  })

  it('amount không hợp lệ (0/âm/thập phân) → invalid_amount', () => {
    const { vendor, bag } = setupVendor()

    bag.add(SPIRIT_STONE_MATERIAL, 100)

    for (const amount of [0, -1, 1.5]) {
      const result = vendor.sellMaterial(bag, 'herb_a_decade', amount, 'mortal')

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('invalid_amount')
    }

    expect(bag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(100)
  })

  it('material không bán được (Linh Thạch) → not_sellable', () => {
    const { vendor, bag } = setupVendor()

    bag.add(SPIRIT_STONE_MATERIAL, 100)

    const result = vendor.sellMaterial(bag, SPIRIT_STONE_MATERIAL_ID, 10, 'mortal')

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not_sellable')
  })

  it('material không tồn tại trong registry → unknown_material', () => {
    const { vendor, bag } = setupVendor()

    const result = vendor.sellMaterial(bag, 'ghost_material', 1, 'mortal')

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unknown_material')
  })

  it('sole-ingredient guard: thảo DUY NHẤT của đan phương, bán hết → từ chối', () => {
    const recipes = [makeRecipe('r_solo', ['solo_herb_decade'])]

    const soloHerb: Material = {
      id: 'solo_herb_decade',
      name: 'solo',
      category: 'herb',
      sourceType: 'exploration',
      profession: {
        resourceKind: 'herb',
        realmId: 'mortal',
        age: 'decade',
        pillRecipeId: 'alchemy_solo_mortal',
        herbBaseId: 'solo_herb',
      },
    }

    const { vendor, bag } = setupVendor([soloHerb], recipes)

    bag.add(soloHerb, 10)

    // Bán 9 (còn 1) — vẫn ổn.
    const partial = vendor.sellMaterial(bag, 'solo_herb_decade', 9, 'mortal')

    expect(partial.ok).toBe(true)

    // Bán nốt 1 → bag trống thảo duy nhất → từ chối.
    const final = vendor.sellMaterial(bag, 'solo_herb_decade', 1, 'mortal')

    expect(final.ok).toBe(false)
    expect(final.reason).toBe('sole_recipe_ingredient')
    expect(bag.getAmount('solo_herb_decade')).toBe(1)
  })

  it('nhiều biến thể thảo của cùng đan phương → KHÔNG bị sole guard chặn', () => {
    const recipes = [makeRecipe('r_multi', ['herb_a_decade', 'herb_b_decade', 'herb_a_century'])]

    const { vendor, bag, registry } = setupVendor([], recipes)

    bag.add(registry.get('herb_a_decade'), 10)
    bag.add(SPIRIT_STONE_MATERIAL, 100)

    const result = vendor.sellMaterial(bag, 'herb_a_decade', 10, 'mortal')

    expect(result.ok).toBe(true)
    expect(bag.getAmount('herb_a_decade')).toBe(0)
  })

  it('bán herb qi_refining (tier 2) — nhận Linh Thạch Hạ (factor 1)', () => {
    // Herb qi_refining decade: 2 × 3 = 6 hạ/đơn vị. 100 đơn vị = 600 hạ,
    // tier < 4 → factor 1 → 600 Hạ.
    const qiHerb = herb('h_qi_decade', 'decade', 'qi_refining')

    const { vendor, bag, registry } = setupVendor([qiHerb])

    bag.add(qiHerb, 100)

    const result = vendor.sellMaterial(bag, 'h_qi_decade', 100, 'qi_refining')

    expect(result.ok).toBe(true)
    expect(result.gained).toBe(600)
    expect(bag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(600)
    expect(bag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)).toBe(0)
  })

  it('bán herb Kim Đan (tier 4) — nhận Linh Thạch Trung (factor 100)', () => {
    // Herb golden_core decade: 2 × 27 = 54 hạ/đơn vị. 100 đơn vị = 5400 hạ
    // / 100 = 54 Trung.
    const gcHerb = herb('h_gc_decade', 'decade', 'golden_core')

    const { vendor, bag, registry } = setupVendor([gcHerb])

    bag.add(gcHerb, 100)

    const result = vendor.sellMaterial(bag, 'h_gc_decade', 100, 'golden_core')

    expect(result.ok).toBe(true)
    expect(result.gained).toBe(54)
    expect(bag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)).toBe(54)
  })

  it('bán herb Vô Lượng (tier 7) — nhận Linh Thạch Thượng (factor 30 000)', () => {
    // Herb void_refinement decade: 2 × 729 = 1458 hạ/đơn vị. 100 000 đơn vị
    // = 145 800 000 hạ / 30 000 = 4860 Thượng. Nhưng stackLimit mặc định
    // 1000, nên add 1000 để test đường code factor.
    const vrHerb = herb('h_vr_decade', 'decade', 'void_refinement')

    const { vendor, bag, registry } = setupVendor([vrHerb])

    bag.add(vrHerb, 1000)

    const result = vendor.sellMaterial(bag, 'h_vr_decade', 1000, 'void_refinement')

    expect(result.ok).toBe(true)
    expect(result.gained).toBe(48)
    expect(bag.getAmount(SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID)).toBe(48)
  })

  it('giá herb tăng theo tuổi và realm tier — sanity bảng', () => {
    const realms = REALM_TIERS.slice(0, 3)

    let previous = 0

    for (const realmId of realms) {
      for (const age of ['decade', 'century', 'millennium', 'myriad_year'] as const) {
        const price = getUnitSellPrice(herb(`sanity_${age}`, age, realmId), realmId)

        expect(price).toBeDefined()
        expect(price!).toBeGreaterThan(previous)

        previous = price!
      }

      previous = 0
    }
  })
})
