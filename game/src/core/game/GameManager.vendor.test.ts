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
  it('bán herb — trừ nguyên liệu, cộng Linh Thạch Hạ đúng giá', () => {
    const { gameManager, player } = setup()

    gameManager.materialBag.add(VENDOR_HERB, 10)

    const result = gameManager.sellMaterialToVendor('vendor_test_herb_decade', 10, player)

    expect(result.ok).toBe(true)
    expect(result.gained).toBe(20)
    expect(gameManager.materialBag.getAmount('vendor_test_herb_decade')).toBe(0)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(20)
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
