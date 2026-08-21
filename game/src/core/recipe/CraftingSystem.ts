import type { Recipe } from './Recipe'
import { CraftingManager } from './CraftingManager'
import type { MaterialBag } from '../material/MaterialBag'
import type { PlayerData } from '../player/Player'
import { getRealmIndex } from '../realm/realmSystem'

export class CraftingSystem {
  constructor(
    private readonly manager: CraftingManager,
    private readonly materialBag: MaterialBag,
  ) {}

  // BUILDing spec mục 16 — `maxSlots` đến từ BuildingSystem.getCraftModifiers()
  // (concurrentJobSlots), do GameManager tự tra rồi truyền vào — CraftingSystem
  // không biết gì về Building.
  canStart(recipe: Recipe, player: PlayerData, maxSlots: number): boolean {
    if (this.manager.getAllFor(recipe.resultType).length >= maxSlots) {
      return false
    }

    if (recipe.requiredRealmId && getRealmIndex(player.realmId) < getRealmIndex(recipe.requiredRealmId)) {
      return false
    }

    if (player.spiritStone < (recipe.spiritStoneCost ?? 0)) {
      return false
    }

    return recipe.materials.every(entry => this.materialBag.has(entry.materialId, entry.amount))
  }

  /**
   * Trả về craftId của lượt vừa bắt đầu (null nếu không đủ điều kiện) —
   * caller (GameManager) cần craftId để theo dõi/thu hoạch ĐÚNG lượt
   * này (không còn định danh bằng resultType do có thể chạy song song
   * nhiều lượt cùng loại).
   */
  start(recipe: Recipe, player: PlayerData, currentTime: number, maxSlots: number): string | null {
    if (!this.canStart(recipe, player, maxSlots)) {
      return null
    }

    player.spiritStone -= recipe.spiritStoneCost ?? 0

    for (const entry of recipe.materials) {
      this.materialBag.remove(entry.materialId, entry.amount)
    }

    const craftId = crypto.randomUUID()

    this.manager.start(recipe, currentTime, craftId)

    return craftId
  }

  // timeReductionPercent (BuildingSystem.getCraftModifiers()) rút ngắn
  // craftDuration thật — 0 = không đổi gì so với hành vi cũ.
  getProgress(craftId: string, recipe: Recipe, currentTime: number, timeReductionPercent = 0): number {
    const active = this.manager.getById(craftId)

    if (!active) {
      return 0
    }

    const effectiveDuration = recipe.craftDuration * (1 - timeReductionPercent / 100)

    return Math.min(1, (currentTime - active.startedAt) / effectiveDuration)
  }

  isReady(craftId: string, recipe: Recipe, currentTime: number, timeReductionPercent = 0): boolean {
    return this.getProgress(craftId, recipe, currentTime, timeReductionPercent) >= 1
  }

  /**
   * Trả lại chính `recipe` nếu đã đủ giờ (để caller — GameManager,
   * nơi cầm sẵn PillBag/TalismanBag/FormationBag — tự thêm sản phẩm
   * vào đúng bag). CraftingSystem không biết về 3 loại bag/registry
   * đó, chỉ quản lý phần thời gian + nguyên liệu.
   */
  collect(craftId: string, recipe: Recipe, currentTime: number, timeReductionPercent = 0): Recipe | null {
    if (!this.isReady(craftId, recipe, currentTime, timeReductionPercent)) {
      return null
    }

    this.manager.stop(craftId)

    return recipe
  }
}
