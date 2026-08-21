import { describe, expect, it } from 'vitest'
import { CraftingSystem } from './CraftingSystem'
import { CraftingManager } from './CraftingManager'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'
import type { Recipe } from './Recipe'
import type { Material } from '../material/Material'

const HERB: Material = {
  id: 'green-spirit-herb',
  name: 'Thanh Linh Thảo',
  category: 'herb',
  sourceType: 'exploration',
  description: '',
}

const RECIPE: Recipe = {
  id: 'recipe_a',
  name: 'A',
  resultType: 'pill',
  resultId: 'pill_a',
  resultAmount: 1,
  materials: [{ materialId: 'green-spirit-herb', amount: 2 }],
  craftDuration: 10,
}

function setup(herbAmount = 10) {
  const materialBag = new MaterialBag()

  materialBag.add(HERB, herbAmount)

  const manager = new CraftingManager()

  const system = new CraftingSystem(manager, materialBag)

  return { materialBag, manager, system }
}

describe('CraftingSystem — Job Slots (BUILDing spec mục 16)', () => {
  it('canStart cho phép tới maxSlots lượt cùng resultType, chặn lượt thứ N+1', () => {
    const { system } = setup()

    const player = createDefaultPlayer()

    expect(system.canStart(RECIPE, player, 2)).toBe(true)

    system.start(RECIPE, player, 0, 2)

    expect(system.canStart(RECIPE, player, 2)).toBe(true)

    system.start(RECIPE, player, 0, 2)

    expect(system.canStart(RECIPE, player, 2)).toBe(false)
  })

  it('start() trừ nguyên liệu mỗi lượt, trả về craftId khác nhau', () => {
    const { system, materialBag } = setup(10)

    const player = createDefaultPlayer()

    const craftId1 = system.start(RECIPE, player, 0, 2)
    const craftId2 = system.start(RECIPE, player, 0, 2)

    expect(craftId1).not.toBeNull()
    expect(craftId2).not.toBeNull()
    expect(craftId1).not.toBe(craftId2)
    expect(materialBag.getAmount('green-spirit-herb')).toBe(6)
  })

  it('start() trả null khi không đủ slot hoặc không đủ nguyên liệu', () => {
    const { system } = setup(0)

    const player = createDefaultPlayer()

    expect(system.start(RECIPE, player, 0, 2)).toBeNull()
  })

  it('timeReductionPercent rút ngắn thời gian tính isReady', () => {
    const { system } = setup()

    const player = createDefaultPlayer()

    const craftId = system.start(RECIPE, player, 0, 2)!

    // craftDuration=10, giảm 50% -> 5s là đủ, chưa tới 10s.
    expect(system.isReady(craftId, RECIPE, 6, 50)).toBe(true)
    expect(system.isReady(craftId, RECIPE, 6, 0)).toBe(false)
  })

  it('collect() chỉ thu đúng craftId đã sẵn sàng, không đụng lượt khác', () => {
    const { system, manager } = setup()

    const player = createDefaultPlayer()

    const craftId1 = system.start(RECIPE, player, 0, 2)!
    const craftId2 = system.start(RECIPE, player, 5, 2)!

    // Tại t=10: craftId1 (start=0) đủ 10s, craftId2 (start=5) mới 5s.
    expect(system.collect(craftId1, RECIPE, 10)).not.toBeNull()
    expect(system.collect(craftId2, RECIPE, 10)).toBeNull()

    expect(manager.getById(craftId1)).toBeUndefined()
    expect(manager.getById(craftId2)).toBeDefined()
  })
})
