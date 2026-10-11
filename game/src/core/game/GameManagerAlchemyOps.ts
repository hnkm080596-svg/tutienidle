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
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import { getAlchemyDoublePill } from '../talent/TalentEffects'
import { isBreakthroughAcquisitionEnabled } from '../realm/ReleasePolicy'
import { BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { betaRecipeFamilyOfId, type BetaRecipeFamily } from '../betaScope'
import type { PlayerData } from '../player/Player'

/**
 * BETA SCOPE LOCK v2 sec.12 - one herb variant's craft sufficiency. Fuel
 * wood is resolved per variant (same realm + same age, the 6E rule) so the
 * row is self-contained for the panel.
 */
export interface BetaAlchemyVariantModel {
  herbMaterialId: string
  herbAmount: number
  herbOwned: number
  /** Materials economy rework - the fuel row is always BUI_GO_ID. */
  fuelWoodMaterialId: string
  fuelWoodAmount: number
  fuelWoodOwned: number
  /** Herb amount AND fuel bui_go are both in the bag. */
  sufficient: boolean
}

/**
 * BETA SCOPE LOCK v2 sec.12 - the canonical beta recipe read-model: only
 * BETA_ENABLED_RECIPE_FAMILIES recipes appear here, each carrying its
 * per-variant ingredient sufficiency, scaled recipe-level costs, live job
 * state, and a single `craftable` verdict. Dormant families never appear -
 * the frontend renders this list directly with no family logic of its own.
 */
export interface BetaAlchemyRecipeModel {
  recipeId: string
  pillId: string
  familyId: BetaRecipeFamily
  realmId: string
  /** The panel's authored filter parity: recipe.realmId === player.realmId. */
  realmMatchesPlayer: boolean
  /** Release-window availability for breakthrough-scoped recipes. */
  breakthroughAvailable: boolean
  variants: BetaAlchemyVariantModel[]
  spiritStoneMaterialId: string
  spiritStoneCost: number
  spiritStoneOwned: number
  /** Materials economy rework - required Luyen Dan Tinh Hoa row. */
  luyenDanTinhHoaMaterialId: string
  luyenDanTinhHoaAmount: number
  luyenDanTinhHoaOwned: number
  specialIngredients: {
    materialId: string
    amount: number
    owned: number
    sufficient: boolean
  }[]
  /** Some variant is afforded AND recipe-level costs are covered. */
  craftable: boolean
  /** The live job burning this recipe, if one is in flight. */
  activeJob?: ActiveAlchemyJob
}

/** Room/job context the panel needs alongside the recipe rows. */
export interface BetaAlchemySurfaceModel {
  roomLevel: number
  maxConcurrentJobs: number
  /** In-flight jobs restricted to beta-family recipes. */
  activeJobs: ActiveAlchemyJob[]
  recipes: BetaAlchemyRecipeModel[]
}

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
    // QA-A F4: report the scope-filtered view, same predicate the state
    // read-model applies - a parked dormant-family job (carried save)
    // still settles in the domain but must not ghost a Thien Co Bang
    // entry or building badge that can never resolve.
    return this.deps.alchemySystem.getJobs()
      .filter((job) => betaRecipeFamilyOfId(job.recipeId) !== null)
  }

  /**
   * Bat dau luyen dan - reserve nguyen lieu ATOMIC (S8.2); slot job theo
   * concurrent_job_slots effect cua pill_room (mac dinh 1).
   * QUEUE REWORK (ruling 2, 2026-10-11) - KHONG co quantity selector:
   * moi lan goi = +1 vien. Cung loai voi order cuoi hang cho thi merge
   * vao order do (quantity + 1, khong ton slot moi); khac loai thi tao
   * order o slot tiep theo. Domain enqueueJob lo phan merge.
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

    // BETA SCOPE LOCK v2 sec.12 - dormant-family recipes report the real
    // reason before room state, same ordering contract as 'retired'.
    // AlchemySystem.startJob repeats this check (domain-level bypass cover).
    if (betaRecipeFamilyOfId(recipe.id) === null) {
      return { ok: false, reason: 'scope_hidden' }
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
    const spiritStoneId = SPIRIT_STONE_MATERIAL_ID

    const maxSlots = this.deps.buildingSystem.getCraftModifiers(instance, template).concurrentJobSlots

    // M3 (spec S4.2) - Hoa Hau Thong Than counter-cost: x2 fuel wood +
    // spirit stone per job. The multiplier is forwarded so the reserve
    // check inside startJob validates the scaled price.
    const costMultiplier = getAlchemyDoublePill(player.selectedTalentIds, player.talentLevels)?.costMultiplier ?? 1

    const started = this.deps.alchemySystem.enqueueJob(
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

  /**
   * QUEUE REWORK - huy order: domain refund herb/go/specials cua cac vien
   * CHUA BAT DAU; ops mirror phan spirit stone (stone id khong nam trong
   * reservation - cung split voi duong charge: domain dot lieu, ops tru
   * stone). Recipe khong resolve duoc (data churn) thi khong suy ra
   * stone id -> bo qua refund stone, lieu trong lo van hoan binh thuong.
   */
  cancelAlchemyJob(jobId: string): boolean {
    const job = this.deps.alchemySystem.getJobs().find((candidate) => candidate.jobId === jobId)

    const cancelled = this.deps.alchemySystem.cancelJob(
      jobId,
      this.deps.materialBag,
      this.deps.materialRegistry,
      Date.now(),
    )

    if (!cancelled.ok || cancelled.unprocessedUnits <= 0 || !job) {
      return cancelled.ok
    }

    // Spirit-stone flatten (QA-A F5): the stone id is a constant and
    // the per-unit cost is stamped on job.reservation - the refund does
    // not need the recipe to resolve, so a recipe-lookup miss still
    // refunds instead of silently voiding the player's stones.
    const spiritStoneId = SPIRIT_STONE_MATERIAL_ID

    if (this.deps.materialRegistry.has(spiritStoneId)) {
      this.deps.materialBag.add(
        this.deps.materialRegistry.get(spiritStoneId),
        job.reservation.spiritStoneCost * cancelled.unprocessedUnits,
      )
    }

    return true
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

    /** Materials economy rework - required tinh hoa (not cost-scaled). */
    luyenDanTinhHoaAmount: number

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

    // BETA SCOPE LOCK v2 sec.12 - dormant families never preview; the
    // query fails closed the same way startJob rejects them.
    if (betaRecipeFamilyOfId(recipe.id) === null) {
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

      luyenDanTinhHoaAmount: recipe.luyenDanTinhHoaAmount,

      spiritStoneCost: Math.ceil(recipe.spiritStoneCost * Math.max(1, costMultiplier)),

      durationSeconds: alchemySecondsFor(recipe, roomLevel),
    }
  }

  /**
   * BETA SCOPE LOCK v2 sec.12 - the canonical beta recipe surface: only
   * BETA_ENABLED_RECIPE_FAMILIES recipes (non-retired), each with
   * per-variant herb + matched-age fuel-wood sufficiency, scaled recipe
   * costs, job state, and a `craftable` verdict. STRICTLY ADDITIVE - no
   * existing accessor changes shape.
   */
  getBetaAlchemyRecipeModels(player: PlayerData): BetaAlchemySurfaceModel {
    const bag = this.deps.materialBag
    const roomInstance = this.deps.buildingManager.getByBuildingId('pill_room')
    const roomLevel = roomInstance?.level ?? 0

    const maxConcurrentJobs = roomInstance
      ? this.deps.buildingSystem.getCraftModifiers(
          roomInstance,
          this.deps.buildingRegistry.get('pill_room'),
        ).concurrentJobSlots
      : 0

    const costMultiplier =
      getAlchemyDoublePill(player.selectedTalentIds, player.talentLevels)
        ?.costMultiplier ?? 1
    const costScale = Math.max(1, costMultiplier)

    const activeJobs = this.deps.alchemySystem.getJobs()

    const recipes: BetaAlchemyRecipeModel[] = []

    for (const recipe of this.deps.alchemyRecipesById.values()) {
      const familyId = betaRecipeFamilyOfId(recipe.id)

      if (familyId === null || recipe.retired === true) {
        continue
      }

      const fuelWoodAmount = Math.ceil(recipe.fuelWoodAmount * costScale)
      const spiritStoneCost = Math.ceil(recipe.spiritStoneCost * costScale)

      const spiritStoneMaterialId = SPIRIT_STONE_MATERIAL_ID
      const spiritStoneOwned = bag.getAmount(spiritStoneMaterialId)

      const fuelWoodOwned = bag.getAmount(BUI_GO_ID)

      const variants: BetaAlchemyVariantModel[] = recipe.herbVariants.map(
        (variant) => {
          const herbOwned = bag.getAmount(variant.materialId)

          return {
            herbMaterialId: variant.materialId,
            herbAmount: recipe.herbAmount,
            herbOwned,
            fuelWoodMaterialId: BUI_GO_ID,
            fuelWoodAmount,
            fuelWoodOwned,
            sufficient:
              herbOwned >= recipe.herbAmount &&
              fuelWoodOwned >= fuelWoodAmount,
          }
        },
      )

      const luyenDanTinhHoaOwned = bag.getAmount(LUYEN_DAN_TINH_HOA_ID)

      const specialIngredients = (recipe.specialIngredients ?? []).map(
        (special) => {
          const owned = bag.getAmount(special.materialId)

          return {
            materialId: special.materialId,
            amount: special.amount,
            owned,
            sufficient: owned >= special.amount,
          }
        },
      )

      const breakthroughAvailable = isBreakthroughAcquisitionEnabled(
        recipe.breakthroughRealmId,
      )

      const craftable =
        breakthroughAvailable &&
        variants.some((variant) => variant.sufficient) &&
        luyenDanTinhHoaOwned >= recipe.luyenDanTinhHoaAmount &&
        spiritStoneOwned >= spiritStoneCost &&
        specialIngredients.every((special) => special.sufficient)

      recipes.push({
        recipeId: recipe.id,
        pillId: recipe.pillId,
        familyId,
        realmId: recipe.realmId,
        realmMatchesPlayer: recipe.realmId === player.realmId,
        breakthroughAvailable,
        variants,
        spiritStoneMaterialId,
        spiritStoneCost,
        spiritStoneOwned,
        luyenDanTinhHoaMaterialId: LUYEN_DAN_TINH_HOA_ID,
        luyenDanTinhHoaAmount: recipe.luyenDanTinhHoaAmount,
        luyenDanTinhHoaOwned,
        specialIngredients,
        craftable,
        activeJob: activeJobs.find((job) => job.recipeId === recipe.id),
      })
    }

    return {
      roomLevel,
      maxConcurrentJobs,
      activeJobs: activeJobs.filter(
        (job) => betaRecipeFamilyOfId(job.recipeId) !== null,
      ),
      recipes,
    }
  }
}
