// Alchemy (2026-08-25, resource-professions-rework plan §8) — Đan Phòng
// mới: mỗi đan phương nhận ĐÚNG một Linh Thảo riêng (có niên đại) +
// Gỗ nhiên liệu + Linh Thạch. Không còn Recipe/CraftingSystem cho đan.
// gp123 6E: nhiên liệu phải CÙNG realm + CÙNG age với thảo được chọn.
//
// §8.2: snapshot recipe/nguyên liệu/level phòng lúc bắt đầu; nguyên liệu
// reserve/trừ atomically lúc start để không dùng một stack cho nhiều job.
// §8.3: totalSuccessPercent = herbAgeBasePercent + roomBonus[level];
// guaranteedPills = floor(total/100); extraPillChance = total % 100.

import type { PillBag } from '../pill/PillBag'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { HerbAge } from '../production/ProductionTypes'
import { HERB_AGE_BASE_SUCCESS_PERCENT } from '../production/ProductionBalance'
import { buildProfessionMaterialId } from '../profession/ProfessionMaterial'
import { mulberry32 } from '../production/ProductionBalance'
import { betaRecipeFamilyOfId, scopeHiddenPillFamilyOfId } from '../betaScope'
import { witnessDigest } from '../math/witnessDigest'

/** Biến thể nguyên liệu của thảo — stack cụ thể trong Bag. */
export interface AlchemyHerbVariant {
  /** Material id đầy đủ (kèm hậu tố niên đại hoặc biến thể legacy). */
  materialId: string

  /** Khóa tra HERB_AGE_BASE_SUCCESS_PERCENT — trục HerbAge 5 bậc (6E C1). */
  age: HerbAge

  /** Nhãn hiển thị biến thể (vd "Bách Niên"). */
  label: string
}

export interface AlchemyRecipe {
  id: string

  /** Đan phương sản xuất (Pill.id). */
  pillId: string

  /** Cảnh giới của đan phương — nhóm UI + gate. */
  realmId: string

  /**
   * Thảo DUY NHẤT được chấp nhận (plan §8.1 — không cho thay thảo khác
   * chỉ vì cùng realm/niên đại). Người chơi chọn biến thể niên đại có
   * sẵn trong Bag.
   */
  herbVariants: readonly AlchemyHerbVariant[]

  herbAmount: number

  /**
   * Realm của gỗ nhiên liệu (gp123 6E) — gỗ phải CÙNG realm này VÀ
   * CÙNG age với thảo được chọn (resolveFuelWood).
   */
  fuelWoodRealmId: string

  fuelWoodAmount: number

  spiritStoneCost: number

  baseDurationSeconds: number

  /**
   * Nguyên liệu đặc biệt ngoài thảo/gỗ (spec dot-pha-loi-kiep §4.1b —
   * vd Yêu Đan của Thông Mạch Đan/Trúc Cơ Đan). undefined = recipe
   * generated theo PILL_FAMILIES, không có nguyên liệu phụ.
   */
  specialIngredients?: { materialId: string; amount: number }[]

  /**
   * M10 (ARCH-008) — retired pill family (Hoi Xuan Dan): the recipe stays
   * resolvable so in-flight jobs from old saves settle normally, but a new
   * job is rejected with reason 'retired' and the recipe is hidden from
   * the craft list.
   */
  retired?: boolean

  /**
   * M-F-CEILING - realm this recipe's breakthrough prepares for (e.g.
   * Truc Co Dan tags 'foundation_establishment'). Breakthrough-scoped
   * recipes are suppressed by release policy
   * (isBreakthroughAcquisitionEnabled) while the transition into that
   * realm is closed; untagged recipes are never release-suppressed.
   */
  breakthroughRealmId?: string
}

export interface ActiveAlchemyJob {
  jobId: string

  recipeId: string

  pillId: string

  /** Biến thể thảo đã reserve (snapshot §8.2). */
  herbMaterialId: string

  startedAtMs: number

  completesAtMs: number

  /** Level Đan Phòng lúc bắt đầu — nâng cấp giữa job chỉ tác động job kế tiếp. */
  roomLevelAtStart: number

  /**
   * F-ALCH-JOB-FORGE - the reservation witness startJob stamps the
   * same moment it burns the inputs. Settle and save validation replay
   * it: a job that never ran the atomic reserve cannot mint the pill.
   */
  reservation: AlchemyJobReservation
}

/**
 * F-ALCH-JOB-FORGE (qa-fixpoint wave 2) - provenance witness for an
 * in-flight job. The persisted job used to carry only the outcome
 * claim (which pill, when it lands); nothing witnessed that startJob
 * actually reserved the inputs, so a fabricated finished job settled
 * the pill for free. The reservation snapshots exactly what the
 * atomic reserve burned - canonical fuel wood id, the scaled costs,
 * herb + specials, and the cost scale applied - folded with the job
 * identity into one digest. A fabricated job can mimic the shape but
 * cannot name the inputs a real startJob reserved; validation/settle
 * re-derive every field from the save's own recipe and reject
 * (reject-not-clamp: witness-mismatch settles as a failed job, never
 * as a rewritten one). A fully self-consistent forged bundle stays
 * possible - the same-value residual class owned by the future
 * online-authority layer.
 */
export interface AlchemyJobReservation {
  /** Canonical fuel wood id reserved: `<realm>_wood_<age>`. */
  readonly woodId: string

  readonly fuelWoodAmount: number

  /** Spirit stone cost the caller deducted - startJob's own formula. */
  readonly spiritStoneCost: number

  readonly herbAmount: number

  readonly specialIngredients: readonly { materialId: string; amount: number }[]

  /** Cost scale the start applied (talent surcharge snapshot, >= 1). */
  readonly costScale: number

  /** FNV-1a fold over the job identity + every reserved input. */
  readonly digest: number
}

/** Everything the reservation digest binds - job identity plus the
 * reserved inputs, in one fixed order shared by writer and verifier. */
export function alchemyJobReservationDigest(
  job: Pick<
    ActiveAlchemyJob,
    'jobId' | 'recipeId' | 'pillId' | 'herbMaterialId' | 'startedAtMs' | 'completesAtMs' | 'roomLevelAtStart'
  >,
  reservation: Omit<AlchemyJobReservation, 'digest'>,
): number {
  return witnessDigest([
    job.jobId,
    job.recipeId,
    job.pillId,
    job.herbMaterialId,
    job.startedAtMs,
    job.completesAtMs,
    job.roomLevelAtStart,
    reservation.woodId,
    reservation.fuelWoodAmount,
    reservation.spiritStoneCost,
    reservation.herbAmount,
    reservation.costScale,
    reservation.specialIngredients.map((special) => `${special.materialId}:${special.amount}`).join(','),
  ])
}

/**
 * Replay a job's reservation witness against the authored recipe.
 * Returns the reservation field whose binding fails, 'digest' when
 * the atomic fold mismatches, or null when the reservation replays a
 * producible startJob reserve. `allowedCostScales` narrows the cost
 * scale to the authored producible set when the caller can supply it
 * (save validation); settle passes none and only replays the
 * recipe-derived bindings + digest.
 */
export function verifyAlchemyJobReservation(
  job: Pick<
    ActiveAlchemyJob,
    'jobId' | 'recipeId' | 'pillId' | 'herbMaterialId' | 'startedAtMs' | 'completesAtMs' | 'roomLevelAtStart'
  > & { reservation: unknown },
  recipe: AlchemyRecipe | undefined,
  allowedCostScales?: ReadonlySet<number>,
): string | null {
  const reservation = job.reservation

  if (typeof reservation !== 'object' || reservation === null) {
    return 'reservation'
  }

  const witness = reservation as AlchemyJobReservation

  if (!Number.isFinite(witness.costScale) || witness.costScale <= 0) {
    return 'costScale'
  }

  if (allowedCostScales !== undefined && !allowedCostScales.has(witness.costScale)) {
    return 'costScale'
  }

  // The digest is recipe-independent - it binds the job identity and
  // every reserved input atomically, so it replays even when the
  // recipe no longer resolves (data changed between save and load).
  if (witness.digest !== alchemyJobReservationDigest(job, witness)) {
    return 'digest'
  }

  if (recipe === undefined) {
    return null
  }

  if (witness.herbAmount !== recipe.herbAmount) {
    return 'herbAmount'
  }

  if (witness.fuelWoodAmount !== Math.ceil(recipe.fuelWoodAmount * witness.costScale)) {
    return 'fuelWoodAmount'
  }

  if (witness.spiritStoneCost !== Math.ceil(recipe.spiritStoneCost * witness.costScale)) {
    return 'spiritStoneCost'
  }

  const expectedSpecials = recipe.specialIngredients ?? []
  const witnessSpecials = witness.specialIngredients

  if (
    !Array.isArray(witnessSpecials) ||
    witnessSpecials.length !== expectedSpecials.length ||
    expectedSpecials.some(
      (expected, index) =>
        witnessSpecials[index]?.materialId !== expected.materialId ||
        witnessSpecials[index]?.amount !== expected.amount,
    )
  ) {
    return 'specialIngredients'
  }

  const variant = recipe.herbVariants.find((candidate) => candidate.materialId === job.herbMaterialId)

  if (!variant) {
    return 'herbMaterialId'
  }

  // 6E - the canonical fuel wood id is derivable: same realm as the
  // recipe, same age as the reserved herb variant.
  if (witness.woodId !== buildProfessionMaterialId('wood', recipe.fuelWoodRealmId, variant.age)) {
    return 'woodId'
  }

  return null
}

export interface AlchemySettlementEvent {
  jobId: string

  pillId: string

  pills: number

  success: boolean

  /** R9 (AR-34) receipt - amount that actually entered the pill bag. */
  delivered: number

  /** R9 (AR-34) receipt - amount lost to a full pill bag (0 = fit). */
  overflow: number
}

export function jobSuccessPercent(
  job: ActiveAlchemyJob,
  recipe: AlchemyRecipe,
  successBonusPercentPoints = 0,
): number {
  const variant = recipe.herbVariants.find((candidate) => candidate.materialId === job.herbMaterialId)

  const base = HERB_AGE_BASE_SUCCESS_PERCENT[variant?.age ?? 'decade']

  const bonus = alchemyRoomSuccessBonus(job.roomLevelAtStart)

  // Optional flat percent-point bonus (content sources may pass one) —
  // added before the guaranteed/extra split, cap 300 preserved (plan §6).
  return Math.min(base + bonus + successBonusPercentPoints, 300)
}

/** Bảng bonus tỷ lệ thành đan theo level Đan Phòng — TÁCH BIỆT bảng speed (§8.3).
 * Đan Phòng maxLevel 9 (buildings.ts) — bảng phải đủ 9 entry; trước đây
 * chỉ 5 entry khiến level 6-9 kẹt ở giá trị level 5 (review 2026-08-28,
 * economy-ecosystem-plan T5). */
export const ALCHEMY_SUCCESS_BONUS_PERCENT: readonly number[] = [0, 5, 10, 15, 20, 25, 30, 35, 40]

/**
 * Bonus % thành đan theo level Đan Phòng — index clamp 1..length. Nguồn
 * sự thật DUY NHẤT cho cả settle (jobSuccessPercent) lẫn preview
 * (GameManager.previewAlchemyOutcome) để hai đường không bao giờ lệch
 * (review 2026-08-28: preview dùng `?? 0` không clamp, settle clamp).
 */
export function alchemyRoomSuccessBonus(roomLevel: number): number {
  const index = Math.min(Math.max(roomLevel, 1), ALCHEMY_SUCCESS_BONUS_PERCENT.length) - 1

  return ALCHEMY_SUCCESS_BONUS_PERCENT[index] ?? 0
}

/** Hệ số tốc độ luyện theo level Đan Phòng (§8.2) — đủ 9 level (T5). */
export const ALCHEMY_SPEED_MULTIPLIERS: readonly number[] = [
  1.0, 1.15, 1.32, 1.52, 1.75, 2.01, 2.31, 2.66, 3.06,
]

export function alchemySecondsFor(recipe: AlchemyRecipe, roomLevel: number): number {
  const multiplier = ALCHEMY_SPEED_MULTIPLIERS[Math.min(Math.max(roomLevel, 1), ALCHEMY_SPEED_MULTIPLIERS.length) - 1] ?? 1

  return Math.ceil(recipe.baseDurationSeconds / multiplier)
}

let jobCounter = 0

function nextJobId(): string {
  jobCounter += 1

  return `alchemy_${Date.now().toString(36)}_${jobCounter}`
}

/**
 * Nhiên liệu lò (gp123 6E — design rule): gỗ phải CÙNG realm với recipe
 * VÀ CÙNG age với thảo được chọn — KHÔNG cheapest-first scan, không
 * xuyên realm, không thay thế age. Chỉ chấp nhận
 * `<realmId>_wood_<requiredAge>`; thiếu → null (job từ chối
 * `missing_fuel_wood`).
 */
export function resolveFuelWood(
  bag: MaterialBag,
  realmId: string,
  amount: number,
  requiredAge: AlchemyHerbVariant['age'],
): string | null {
  const candidate = buildProfessionMaterialId('wood', realmId, requiredAge)

  return bag.has(candidate, amount) ? candidate : null
}

export class AlchemySystem {
  private jobs: ActiveAlchemyJob[] = []

  private pendingEvents: AlchemySettlementEvent[] = []

  /**
   * M1 (ARCH-001) — restore REPLACES the job list with detached copies:
   * the payload is a value, so mutating it afterwards must not leak into
   * live state (A3).
   */
  restoreJobs(jobs: ActiveAlchemyJob[]): void {
    this.jobs = jobs.map((job) => ({
      ...job,
      reservation: {
        ...job.reservation,
        specialIngredients: (job.reservation?.specialIngredients ?? []).map((special) => ({ ...special })),
      },
    }))
  }

  getJobs(): ActiveAlchemyJob[] {
    return [...this.jobs]
  }

  drainSettlementEvents(): AlchemySettlementEvent[] {
    const events = this.pendingEvents

    this.pendingEvents = []

    return events
  }

  hasActiveJob(): boolean {
    return this.jobs.length > 0
  }

  /**
   * Bắt đầu job — validation TRƯỚC, trừ TOÀN BỘ sau khi hợp lệ
   * (atomic reserve, plan §7.2/§8.2). Trả về lỗi cụ thể cho UI preview.
   */
  startJob(
    recipe: AlchemyRecipe,
    herbMaterialId: string,
    bag: MaterialBag,
    registry: MaterialRegistry,
    spiritStone: number,
    roomLevel: number,
    nowMs: number,
    maxConcurrentJobs: number,
    // M3 (talent v4 §4.2) — Hoa Hau Thong Than counter-cost: multiplies
    // fuel wood + spirit stone requirements; herb/specials stay base.
    costMultiplier = 1,
  ): { ok: boolean; reason?: string; spiritStoneCost?: number } {
    // BETA SCOPE LOCK v2 sec.12 - recipe families outside
    // BETA_ENABLED_RECIPE_FAMILIES are dormant: their definitions stay in
    // the registry but jobs cannot start via ANY entry path (the domain
    // fails closed, not just the ops layer). In-flight/loaded jobs for
    // dormant families are unaffected - only startJob is gated.
    if (betaRecipeFamilyOfId(recipe.id) === null) {
      return { ok: false, reason: 'scope_hidden' }
    }

    // M10 (ARCH-008) — retired pill families (Hoi Xuan Dan) cannot start
    // new jobs; in-flight jobs still settle via the resolvable recipe.
    if (recipe.retired === true) {
      return { ok: false, reason: 'retired' }
    }

    // Scope-hidden families keep their in-flight jobs settling but may
    // not occupy the live slot budget - a restored dormant job rendered
    // nowhere would otherwise reject every beta recipe job_slots_full
    // with no visible cause or cancel path.
    const liveJobs = this.jobs.filter((job) => betaRecipeFamilyOfId(job.recipeId) !== null)

    if (liveJobs.length >= Math.max(1, maxConcurrentJobs)) {
      return { ok: false, reason: 'job_slots_full' }
    }

    const variant = recipe.herbVariants.find((candidate) => candidate.materialId === herbMaterialId)

    if (!variant) {
      return { ok: false, reason: 'wrong_herb' }
    }

    if (!registry.has(herbMaterialId)) {
      return { ok: false, reason: 'wrong_herb' }
    }

    // Counter-cost is a surcharge — clamp >= 1 so bad data can't make jobs free.
    const costScale = Math.max(1, costMultiplier)

    const fuelWoodAmount = Math.ceil(recipe.fuelWoodAmount * costScale)
    const spiritStoneCost = Math.ceil(recipe.spiritStoneCost * costScale)

    // 6E — nhiên liệu CÙNG age với thảo đã chọn (variant luôn có age
    // theo type — post-C2 mọi thảo đều `profession.age`).
    const woodId = resolveFuelWood(bag, recipe.fuelWoodRealmId, fuelWoodAmount, variant.age)

    if (!woodId) {
      return { ok: false, reason: 'missing_fuel_wood' }
    }

    if (!bag.has(herbMaterialId, recipe.herbAmount)) {
      return { ok: false, reason: 'missing_herb' }
    }

    if (spiritStone < spiritStoneCost) {
      return { ok: false, reason: 'missing_spirit_stone' }
    }

    // Nguyên liệu đặc biệt (spec dot-pha-loi-kiep §4.1b) — check đủ
    // TẤT CẢ trước khi reserve bất cứ thứ gì (giữ atomic §7.2).
    for (const special of recipe.specialIngredients ?? []) {
      if (!bag.has(special.materialId, special.amount)) {
        return { ok: false, reason: 'missing_special_ingredient' }
      }
    }

    // Reserve atomic — trừ toàn bộ sau khi mọi check pass.
    bag.remove(herbMaterialId, recipe.herbAmount)

    bag.remove(woodId, fuelWoodAmount)

    for (const special of recipe.specialIngredients ?? []) {
      bag.remove(special.materialId, special.amount)
    }

    const jobId = nextJobId()
    const completesAtMs = nowMs + alchemySecondsFor(recipe, roomLevel) * 1000
    const specialIngredients = (recipe.specialIngredients ?? []).map((special) => ({ ...special }))

    // F-ALCH-JOB-FORGE - stamp the reservation witness at the same
    // atomic point the inputs burn: only a real startJob reserve can
    // produce this record.
    const reservation: AlchemyJobReservation = {
      woodId,
      fuelWoodAmount,
      spiritStoneCost,
      herbAmount: recipe.herbAmount,
      specialIngredients,
      costScale,
      digest: alchemyJobReservationDigest(
        {
          jobId,
          recipeId: recipe.id,
          pillId: recipe.pillId,
          herbMaterialId,
          startedAtMs: nowMs,
          completesAtMs,
          roomLevelAtStart: roomLevel,
        },
        {
          woodId,
          fuelWoodAmount,
          spiritStoneCost,
          herbAmount: recipe.herbAmount,
          specialIngredients,
          costScale,
        },
      ),
    }

    this.jobs.push({
      jobId,
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId,
      startedAtMs: nowMs,
      completesAtMs,
      roomLevelAtStart: roomLevel,
      reservation,
    })

    // Caller deducts exactly the cost validated here — single formula.
    return { ok: true, spiritStoneCost }
  }

  /** Huỷ job — nguyên liệu đã đốt không hoàn trả (lò đã khởi động). */
  cancelJob(jobId: string): boolean {
    const before = this.jobs.length

    this.jobs = this.jobs.filter((job) => job.jobId !== jobId)

    return this.jobs.length < before
  }

  /**
   * Settle job hoàn thành theo công thức §8.3: luôn nhận guaranteedPills,
   * roll một lần theo extraPillChance để nhận thêm một viên. Idempotent —
   * settle xoá job trước khi cộng Bag.
   */
  tick(
    nowMs: number,
    pillBag: PillBag,
    resolvePill: (pillId: string) => { id: string } | undefined,
    random: () => number = Math.random,
    successBonusPercentPoints = 0,
    // M3 — Hoa Hau Thong Than: successful jobs yield pills x multiplier.
    pillYieldMultiplier = 1,
  ): void {
    const remaining: ActiveAlchemyJob[] = []

    for (const job of this.jobs) {
      if (nowMs < job.completesAtMs) {
        remaining.push(job)

        continue
      }

      const recipe = this.recipeLookup?.(job.recipeId)

      // BETA SCOPE LOCK - a carried dormant-family job stays inert at
      // the delivery seam: startJob gates origination but restore and
      // settle used to trust persisted intent. The record parks (data
      // intact) - no pill lands and no event/toast fires. Only AUTHORED
      // dormant recipes park: an unknown/corrupt recipeId falls through
      // to the recipe-miss failure arm instead of parking forever.
      // F-TC6-4: retired is NOT an exemption - hoi_xuan_dan is retired
      // AND scope-hidden, and dormancy is the stronger claim (the
      // retired contract predates the scope lock).
      if (scopeHiddenPillFamilyOfId(job.recipeId) !== null) {
        remaining.push(job)

        continue
      }

      // F-A7-3: settle re-derives the deliverable from the authored
      // recipe - job.pillId is only a denormalized snapshot, so a forged
      // job claiming a different pill can never mint it.
      const pill = recipe !== undefined ? resolvePill(recipe.pillId) : undefined

      if (!recipe || !pill) {
        // Recipe/pill không resolve được (data đổi/xoá giữa save và load) —
        // TRƯỚC ĐÂY job bị xoá im lặng, mất trắng nguyên liệu đã reserve mà
        // không có event nào (review 2026-08-28). Giờ phát event thất bại để
        // UI thông báo; nguyên liệu đã đốt KHÔNG hoàn trả (job coi như luyện
        // thất bại — đúng semantic §8.3, không tạo refund exploit).
        this.pendingEvents.push({
          jobId: job.jobId,
          pillId: job.pillId,
          pills: 0,
          success: false,
          delivered: 0,
          overflow: 0,
        })

        continue
      }

      // F-ALCH-JOB-FORGE - settle replays the reservation witness
      // startJob stamped when it burned the inputs. A fabricated job
      // (persisted record that never reserved materials) cannot
      // produce the witness and settles as a failed job instead of
      // minting the pill for free - same arm as a recipe/pill miss,
      // burned inputs never refund.
      if (verifyAlchemyJobReservation(job, recipe) !== null) {
        this.pendingEvents.push({
          jobId: job.jobId,
          pillId: job.pillId,
          pills: 0,
          success: false,
          delivered: 0,
          overflow: 0,
        })

        continue
      }

      const totalPercent = jobSuccessPercent(job, recipe, successBonusPercentPoints)

      const guaranteedPills = Math.floor(totalPercent / 100)

      const extraPillChance = totalPercent % 100

      let pills = guaranteedPills

      if (random() * 100 < extraPillChance) {
        pills += 1
      }

      pills = Math.floor(pills * Math.max(0, pillYieldMultiplier))

      if (pills > 0) {
        const overflow = pillBag.add(pill as Parameters<typeof pillBag.add>[0], pills)

        // R9 (AR-34): surface the delivery receipt instead of ignoring it.
        this.pendingEvents.push({
          jobId: job.jobId,
          pillId: recipe.pillId,
          pills,
          success: pills > 0,
          delivered: pills - overflow,
          overflow,
        })

        continue
      }

      this.pendingEvents.push({
        jobId: job.jobId,
        pillId: job.pillId,
        pills,
        success: pills > 0,
        delivered: 0,
        overflow: 0,
      })
    }

    this.jobs = remaining
  }

  /** Offline settle — job hoàn thành trong quá khứ settle đúng một lần. */
  settleOffline(
    pillBag: PillBag,
    resolvePill: (pillId: string) => { id: string } | undefined,
    nowMs: number = Date.now(),
    successBonusPercentPoints = 0,
    pillYieldMultiplier = 1,
    rng: () => number = Math.random,
  ): number {
    const before = this.jobs.length

    this.tick(nowMs, pillBag, resolvePill, rng, successBonusPercentPoints, pillYieldMultiplier)

    return before - this.jobs.length
  }

  /** Wiring recipe lookup từ GameManager để tick resolve snapshot recipe. */
  private recipeLookup?: (recipeId: string) => AlchemyRecipe | undefined

  setRecipeLookup(lookup: (recipeId: string) => AlchemyRecipe | undefined): void {
    this.recipeLookup = lookup
  }
}

export { mulberry32 as alchemyMulberry32 }
