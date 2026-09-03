import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'
import { BuildingSystem } from '../building/BuildingSystem'
import {
  AlchemySystem,
  alchemySecondsFor,
  alchemyRoomSuccessBonus,
  type ActiveAlchemyJob,
  type AlchemyRecipe,
} from '../alchemy/AlchemySystem'
import { HERB_AGE_BASE_SUCCESS_PERCENT } from '../production/ProductionBalance'
import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import { getRealmTier } from '../realm/RealmTierMap'
import type { PlayerData } from '../player/Player'

export interface GameManagerAlchemyOpsDeps {
  alchemySystem: AlchemySystem
  // GameManager sở hữu map recipe (đăng ký qua registerAlchemyRecipes,
  // nằm ngoài phạm vi ALCHEMY section) — cùng instance Map được share qua
  // reference, KHÔNG snapshot, giống materialBag/buildingManager bên dưới.
  alchemyRecipesById: Map<string, AlchemyRecipe>
  buildingManager: BuildingManager
  buildingRegistry: BuildingRegistry
  buildingSystem: BuildingSystem
  materialBag: MaterialBag
  materialRegistry: MaterialRegistry
}

/**
 * Tách khỏi GameManager (2026-09-03, task 3 — GameManager split) — toàn bộ
 * thao tác Đan Phòng (query recipe/room level/jobs, start/cancel job,
 * preview outcome). Cùng pattern DI với EquipmentOpsSystem/
 * GameManagerBuildingOps: constructor nhận dependency tường minh qua object
 * `deps`, KHÔNG tự import ngược GameManager.
 */
export class GameManagerAlchemyOps {
  constructor(private readonly deps: GameManagerAlchemyOpsDeps) {}

  getAlchemyRecipes(): AlchemyRecipe[] {
    return Array.from(this.deps.alchemyRecipesById.values())
  }

  getAlchemyRecipe(recipeId: string): AlchemyRecipe | undefined {
    return this.deps.alchemyRecipesById.get(recipeId)
  }

  /** Level Đan Phòng (pill_room) hiện hành — chưa xây = 0. */
  getAlchemyRoomLevel(): number {
    return this.deps.buildingManager.getByBuildingId('pill_room')?.level ?? 0
  }

  getAlchemyJobs(): ActiveAlchemyJob[] {
    return this.deps.alchemySystem.getJobs()
  }

  /**
   * Bắt đầu luyện đan — reserve nguyên liệu ATOMIC (§8.2); slot job theo
   * concurrent_job_slots effect của pill_room (mặc định 1).
   */
  startAlchemyJob(
    recipeId: string,
    herbMaterialId: string,
    _player: PlayerData,
  ): { ok: boolean; reason?: string } {
    const recipe = this.deps.alchemyRecipesById.get(recipeId)

    if (!recipe) {
      return { ok: false, reason: 'not_found' }
    }

    const instance = this.deps.buildingManager.getByBuildingId('pill_room')

    if (!instance) {
      return { ok: false, reason: 'room_not_built' }
    }

    const template = this.deps.buildingRegistry.get('pill_room')
    const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(recipe.realmId))

    const maxSlots = this.deps.buildingSystem.getCraftModifiers(instance, template).concurrentJobSlots

    const started = this.deps.alchemySystem.startJob(
      recipe,

      herbMaterialId,

      this.deps.materialBag,

      this.deps.materialRegistry,

      this.deps.materialBag.getAmount(spiritStoneId),

      instance.level,

      Date.now(),

      maxSlots,
    )

    // Bugfix (review 2026-08-26) — Linh Thạch được CHECK ở startJob
    // nhưng chưa từng được TRỪ: luyện đan miễn phí. Trừ sau khi reserve
    // nguyên liệu thành công (all-or-nothing như mọi sink khác).
    // Plan Workstream F — trừ trên MaterialBag.
    if (started.ok && recipe.spiritStoneCost > 0) {
      this.deps.materialBag.remove(spiritStoneId, recipe.spiritStoneCost)
    }

    return started
  }

  cancelAlchemyJob(jobId: string): boolean {
    return this.deps.alchemySystem.cancelJob(jobId)
  }

  /** Preview tổng tỷ lệ thành + guaranteed + chance viên cộng thêm (§9.3). */
  previewAlchemyOutcome(
    recipeId: string,
    herbMaterialId: string,
    roomLevel = Math.max(1, this.getAlchemyRoomLevel()),
  ): {
    totalPercent: number

    guaranteedPills: number

    extraPillChance: number

    durationSeconds: number
  } | null {
    const recipe = this.deps.alchemyRecipesById.get(recipeId)

    const variant = recipe?.herbVariants.find(
      (candidate) => candidate.materialId === herbMaterialId,
    )

    if (!recipe || !variant) {
      return null
    }

    const totalPercent = Math.min(
      (HERB_AGE_BASE_SUCCESS_PERCENT[variant.age] ?? 0) + alchemyRoomSuccessBonus(roomLevel),
      300,
    )

    return {
      totalPercent,

      guaranteedPills: Math.floor(totalPercent / 100),

      extraPillChance: totalPercent % 100,

      durationSeconds: alchemySecondsFor(recipe, roomLevel),
    }
  }
}
