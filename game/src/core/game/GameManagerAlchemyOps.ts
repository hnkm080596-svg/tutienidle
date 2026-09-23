import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'
import { BuildingSystem } from '../building/BuildingSystem'
import {
  AlchemySystem,
  alchemySecondsFor,
  jobSuccessPercent,
  type ActiveAlchemyJob,
  type AlchemyRecipe,
} from '../alchemy/AlchemySystem'
import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import { getRealmTier } from '../realm/RealmTierMap'
import { getAlchemyDoublePill } from '../talent/TalentEffects'
import { isBreakthroughAcquisitionEnabled } from '../realm/ReleasePolicy'
import type { PlayerData } from '../player/Player'

export interface GameManagerAlchemyOpsDeps {
  alchemySystem: AlchemySystem
  // GameManager so huu map recipe (dang ky qua registerAlchemyRecipes,
  // nam ngoai pham vi ALCHEMY section) - cung instance Map duoc share qua
  // reference, KHONG snapshot, giong materialBag/buildingManager ben duoi.
  alchemyRecipesById: Map<string, AlchemyRecipe>
  buildingManager: BuildingManager
  buildingRegistry: BuildingRegistry
  buildingSystem: BuildingSystem
  materialBag: MaterialBag
  materialRegistry: MaterialRegistry
}

/**
 * Tach khoi GameManager (2026-09-03, task 3 - GameManager split) - toan bo
 * thao tac Dan Phong (query recipe/room level/jobs, start/cancel job,
 * preview outcome). Cung pattern DI voi EquipmentOpsSystem/
 * GameManagerBuildingOps: constructor nhan dependency tuong minh qua object
 * `deps`, KHONG tu import nguoc GameManager.
 */
export class GameManagerAlchemyOps {
  constructor(private readonly deps: GameManagerAlchemyOpsDeps) {}

  getAlchemyRecipes(): AlchemyRecipe[] {
    return Array.from(this.deps.alchemyRecipesById.values())
  }

  getAlchemyRecipe(recipeId: string): AlchemyRecipe | undefined {
    return this.deps.alchemyRecipesById.get(recipeId)
  }

  /** Level Dan Phong (pill_room) hien hanh - chua xay = 0. */
  getAlchemyRoomLevel(): number {
    return this.deps.buildingManager.getByBuildingId('pill_room')?.level ?? 0
  }

  getAlchemyJobs(): ActiveAlchemyJob[] {
    return this.deps.alchemySystem.getJobs()
  }

  /**
   * Bat dau luyen dan - reserve nguyen lieu ATOMIC (S8.2); slot job theo
   * concurrent_job_slots effect cua pill_room (mac dinh 1).
   */
  startAlchemyJob(
    recipeId: string,
    herbMaterialId: string,
    player: PlayerData,
  ): { ok: boolean; reason?: string } {
    const recipe = this.deps.alchemyRecipesById.get(recipeId)

    if (!recipe) {
      return { ok: false, reason: 'not_found' }
    }

    // M10 (ARCH-008) - retired recipe reports 'retired' regardless of room
    // state so the caller sees the real reason, not a room-level miss.
    if (recipe.retired === true) {
      return { ok: false, reason: 'retired' }
    }

    // M-F-CEILING - a breakthrough-scoped recipe is suppressed by release
    // policy while the transition into its tagged realm is closed (same
    // real-reason-first ordering as 'retired').
    if (!isBreakthroughAcquisitionEnabled(recipe.breakthroughRealmId)) {
      return { ok: false, reason: 'realm_unavailable' }
    }

    const instance = this.deps.buildingManager.getByBuildingId('pill_room')

    if (!instance) {
      return { ok: false, reason: 'room_not_built' }
    }

    const template = this.deps.buildingRegistry.get('pill_room')
    const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(recipe.realmId))

    const maxSlots = this.deps.buildingSystem.getCraftModifiers(instance, template).concurrentJobSlots

    // M3 (spec S4.2) - Hoa Hau Thong Than counter-cost: x2 fuel wood +
    // spirit stone per job. The multiplier is forwarded so the reserve
    // check inside startJob validates the scaled price.
    const costMultiplier = getAlchemyDoublePill(player.selectedTalentIds, player.talentLevels)?.costMultiplier ?? 1

    const started = this.deps.alchemySystem.startJob(
      recipe,

      herbMaterialId,

      this.deps.materialBag,

      this.deps.materialRegistry,

      this.deps.materialBag.getAmount(spiritStoneId),

      instance.level,

      Date.now(),

      maxSlots,

      costMultiplier,
    )

    // Bugfix (review 2026-08-26) - Linh Thach duoc CHECK o startJob
    // nhung chua tung duoc TRU: luyen dan mien phi. Tru sau khi reserve
    // nguyen lieu thanh cong (all-or-nothing nhu moi sink khac).
    // Plan Workstream F - tru tren MaterialBag. Tru dung so startJob da
    // validate (single formula - scaled cost tra ve trong result).
    if (started.ok && started.spiritStoneCost) {
      this.deps.materialBag.remove(spiritStoneId, started.spiritStoneCost)
    }

    return started
  }

  cancelAlchemyJob(jobId: string): boolean {
    return this.deps.alchemySystem.cancelJob(jobId)
  }

  /**
   * Preview tong ty le thanh + guaranteed + chance vien cong them (S9.3).
   * M3 - truyen `player` de preview phan anh Hoa Hau Thong Than (cost x2,
   * yield x2) giong het startJob/tick se charge/pay (AR-23 parity).
   */
  previewAlchemyOutcome(
    recipeId: string,
    herbMaterialId: string,
    roomLevel = Math.max(1, this.getAlchemyRoomLevel()),
    player?: PlayerData,
  ): {
    totalPercent: number

    guaranteedPills: number

    extraPillChance: number

    extraPillYield: number

    yieldMultiplier: number

    costMultiplier: number

    fuelWoodAmount: number

    spiritStoneCost: number

    durationSeconds: number
  } | null {
    const recipe = this.deps.alchemyRecipesById.get(recipeId)

    const variant = recipe?.herbVariants.find(
      (candidate) => candidate.materialId === herbMaterialId,
    )

    if (!recipe || !variant) {
      return null
    }

    // R9 (AR-23): the success split is the alchemy authority's rule
    // (jobSuccessPercent) - the preview no longer reproduces it. The
    // preview is pre-job, so a minimal job shape carrying the two fields
    // the formula reads (herbMaterialId, roomLevelAtStart) is enough.
    const totalPercent = jobSuccessPercent(
      { herbMaterialId, roomLevelAtStart: roomLevel } as ActiveAlchemyJob,
      recipe,
    )

    const effect = player ? getAlchemyDoublePill(player.selectedTalentIds, player.talentLevels) : undefined

    const yieldMultiplier = effect?.yieldMultiplier ?? 1

    const costMultiplier = effect?.costMultiplier ?? 1

    const baseGuaranteed = Math.floor(totalPercent / 100)

    return {
      totalPercent,

      guaranteedPills: Math.floor(baseGuaranteed * yieldMultiplier),

      extraPillChance: totalPercent % 100,

      // So vien cong them khi roll trung - khop voi floor((g+1)*y)-floor(g*y).
      extraPillYield:
        Math.floor((baseGuaranteed + 1) * yieldMultiplier) -
        Math.floor(baseGuaranteed * yieldMultiplier),

      yieldMultiplier,

      costMultiplier,

      fuelWoodAmount: Math.ceil(recipe.fuelWoodAmount * Math.max(1, costMultiplier)),

      spiritStoneCost: Math.ceil(recipe.spiritStoneCost * Math.max(1, costMultiplier)),

      durationSeconds: alchemySecondsFor(recipe, roomLevel),
    }
  }
}
