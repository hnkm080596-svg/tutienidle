import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import {
  SPIRIT_STONE_MATERIAL,
  SPIRIT_STONE_MATERIAL_ID,
} from '../material/SpiritStoneMaterial'
import type { Material } from '../material/Material'
import type { AlchemyRecipe } from '../alchemy/AlchemySystem'

const VENDOR_HERB: Material = {
  id: 'vendor_test_herb_decade',

  name: 'Vendor Test Herb',

  category: 'herb',

  sourceType: 'exploration',

  profession: {
    resourceKind: 'herb',

    realmId: 'mortal',

    age: 'decade',

    pillRecipeId: 'alchemy_vendor_test_mortal',

    herbBaseId: 'vendor_test_herb',
  },
}

function setup(recipes: AlchemyRecipe[] = []) {
  const gameManager = new GameManager()

  gameManager.registerMaterials([SPIRIT_STONE_MATERIAL, VENDOR_HERB])

  if (recipes.length > 0) {
    gameManager.registerAlchemyRecipes(recipes)
  }

  const player = createDefaultPlayer()

  return { gameManager, player }
}

describe('GameManager.sellMaterialToVendor — economy-fixes-sinks-plan §3.2 B2', () => {
  it('bán herb phẩm thấp hơn cảnh giới — trừ nguyên liệu, cộng Linh Thạch Hạ đúng giá', () => {
    const { gameManager, player } = setup()

    // gp123 6G: người chơi luyện khí (bát phẩm) bán herb phàm nhân (cửu phẩm).
    player.realmId = 'qi_refining'

    gameManager.materialBag.add(VENDOR_HERB, 10)

    const result = gameManager.sellMaterialToVendor('vendor_test_herb_decade', 10, player)

    expect(result.ok).toBe(true)
    expect(result.gained).toBe(20)
    expect(gameManager.materialBag.getAmount('vendor_test_herb_decade')).toBe(0)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(20)
  })

  it('người chơi phàm nhân bán herb phàm nhân (phẩm BẰNG) → grade_not_below', () => {
    const { gameManager, player } = setup()

    gameManager.materialBag.add(VENDOR_HERB, 10)

    const result = gameManager.sellMaterialToVendor('vendor_test_herb_decade', 10, player)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('grade_not_below')
    expect(gameManager.materialBag.getAmount('vendor_test_herb_decade')).toBe(10)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
  })

  it('người chơi luyện khí KHÔNG thấy herb kim đan trong getVendorSellableRows', () => {
    const { gameManager, player } = setup()

    player.realmId = 'qi_refining'

    const gcHerb: Material = {
      ...VENDOR_HERB,
      id: 'vendor_test_herb_gc_decade',
      profession: {
        resourceKind: 'herb',

        realmId: 'golden_core',

        age: 'decade',

        pillRecipeId: 'alchemy_vendor_test_golden_core',

        herbBaseId: 'vendor_test_herb_gc',
      },
    }

    gameManager.registerMaterials([gcHerb])

    gameManager.materialBag.add(VENDOR_HERB, 5)
    gameManager.materialBag.add(gcHerb, 5)

    const rows = gameManager.getVendorSellableRows(player)

    expect(rows.map((row) => row.materialId)).toEqual(['vendor_test_herb_decade'])
  })

  it('người chơi phàm nhân → getVendorSellableRows rỗng (không có phẩm thấp hơn Cửu Phẩm)', () => {
    const { gameManager, player } = setup()

    gameManager.materialBag.add(VENDOR_HERB, 5)

    expect(gameManager.getVendorSellableRows(player)).toEqual([])
  })

  it('thảo DUY NHẤT của đan phương đã đăng ký — bán hết bị sole_recipe_ingredient chặn', () => {
    const { gameManager, player } = setup([
      {
        id: 'alchemy_vendor_test_mortal',

        pillId: 'pill_vendor_test',

        realmId: 'mortal',

        herbVariants: [{ materialId: 'vendor_test_herb_decade', age: 'decade', label: 'Thập Niên' }],

        herbAmount: 1,

        fuelWoodRealmId: 'mortal',

        fuelWoodAmount: 1,

        spiritStoneCost: 10,

        baseDurationSeconds: 10,
      },
    ])

    player.realmId = 'qi_refining'

    gameManager.materialBag.add(VENDOR_HERB, 10)

    const result = gameManager.sellMaterialToVendor('vendor_test_herb_decade', 10, player)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('sole_recipe_ingredient')
    expect(gameManager.materialBag.getAmount('vendor_test_herb_decade')).toBe(10)
  })

  it('Linh Thạch không bán được → not_sellable', () => {
    const { gameManager, player } = setup()

    gameManager.materialBag.add(SPIRIT_STONE_MATERIAL, 100)

    const result = gameManager.sellMaterialToVendor(SPIRIT_STONE_MATERIAL_ID, 10, player)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not_sellable')
  })
})
