import type { Recipe, RecipeResultType } from './Recipe'

export interface ActiveCraft {
  craftId: string

  recipeId: string

  resultType: RecipeResultType

  startedAt: number
}

/**
 * BUILDing spec mục 16 (Concurrent Jobs) — Building level giờ có thể
 * mở nhiều Job Slot đồng thời CHO CÙNG 1 resultType (vd 3 lò Luyện
 * Đan chạy song song), nên lưu trữ đổi từ 1 slot/resultType (Map)
 * sang mảng phẳng, định danh từng lượt craft bằng `craftId` riêng
 * (CraftingSystem.start() sinh, cùng pattern instanceId của
 * BuildingSystem.build()) — không còn dùng resultType làm khoá duy
 * nhất được nữa vì có thể có NHIỀU ActiveCraft cùng resultType.
 */
export class CraftingManager {
  private active: ActiveCraft[] = []

  start(recipe: Recipe, currentTime: number, craftId: string): ActiveCraft {
    const craft: ActiveCraft = {
      craftId,

      recipeId: recipe.id,

      resultType: recipe.resultType,

      startedAt: currentTime,
    }

    this.active.push(craft)

    return craft
  }

  getAllFor(resultType: RecipeResultType): ActiveCraft[] {
    return this.active.filter(craft => craft.resultType === resultType)
  }

  getById(craftId: string): ActiveCraft | undefined {
    return this.active.find(craft => craft.craftId === craftId)
  }

  stop(craftId: string) {
    this.active = this.active.filter(craft => craft.craftId !== craftId)
  }

  getAll(): ActiveCraft[] {
    return [...this.active]
  }

  /**
   * Nạp lại state từ save — bỏ qua guard "đủ slot" của start(), giống
   * ExplorationManager.restore().
   */
  restore(entries: ActiveCraft[]) {
    this.active = [...entries]
  }
}
