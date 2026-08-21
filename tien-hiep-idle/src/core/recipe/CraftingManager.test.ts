import { describe, expect, it } from 'vitest'
import { CraftingManager } from './CraftingManager'
import type { Recipe } from './Recipe'

const PILL_RECIPE: Recipe = {
  id: 'recipe_a',
  name: 'A',
  resultType: 'pill',
  resultId: 'pill_a',
  resultAmount: 1,
  materials: [],
  craftDuration: 10,
}

const TALISMAN_RECIPE: Recipe = {
  id: 'recipe_b',
  name: 'B',
  resultType: 'talisman',
  resultId: 'talisman_b',
  resultAmount: 1,
  materials: [],
  craftDuration: 10,
}

describe('CraftingManager — nhiều lượt craft song song cùng resultType (BUILDing spec mục 16)', () => {
  it('start() cho phép nhiều ActiveCraft cùng resultType, mỗi cái 1 craftId riêng', () => {
    const manager = new CraftingManager()

    manager.start(PILL_RECIPE, 0, 'craft-1')
    manager.start(PILL_RECIPE, 5, 'craft-2')

    const pillCrafts = manager.getAllFor('pill')

    expect(pillCrafts).toHaveLength(2)
    expect(pillCrafts.map(c => c.craftId).sort()).toEqual(['craft-1', 'craft-2'])
  })

  it('getAllFor lọc đúng resultType, không lẫn loại khác', () => {
    const manager = new CraftingManager()

    manager.start(PILL_RECIPE, 0, 'craft-1')
    manager.start(TALISMAN_RECIPE, 0, 'craft-2')

    expect(manager.getAllFor('pill')).toHaveLength(1)
    expect(manager.getAllFor('talisman')).toHaveLength(1)
    expect(manager.getAllFor('formation')).toHaveLength(0)
  })

  it('stop() chỉ xoá đúng craftId, không đụng lượt khác', () => {
    const manager = new CraftingManager()

    manager.start(PILL_RECIPE, 0, 'craft-1')
    manager.start(PILL_RECIPE, 0, 'craft-2')

    manager.stop('craft-1')

    expect(manager.getById('craft-1')).toBeUndefined()
    expect(manager.getById('craft-2')).toBeDefined()
    expect(manager.getAllFor('pill')).toHaveLength(1)
  })

  it('restore() nạp lại nguyên trạng thái từ save, bỏ qua guard', () => {
    const manager = new CraftingManager()

    manager.restore([
      { craftId: 'x', recipeId: 'recipe_a', resultType: 'pill', startedAt: 100 },
      { craftId: 'y', recipeId: 'recipe_a', resultType: 'pill', startedAt: 200 },
    ])

    expect(manager.getAll()).toHaveLength(2)
    expect(manager.getById('y')?.startedAt).toBe(200)
  })
})
