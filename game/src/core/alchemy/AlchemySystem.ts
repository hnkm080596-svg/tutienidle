// Alchemy (2026-08-25, resource-professions-rework plan §8) — Đan Phòng
// mới: mỗi đan phương nhận ĐÚng một Linh Thảo riêng (có niên đại) +
// Gỗ nhiên liệu + Linh Thạch. Không còn Recipe/CraftingSystem cho đan.
//
// §8.2: snapshot recipe/nguyên liệu/level phòng lúc bắt đầu; nguyên liệu
// reserve/trừ atomically lúc start để không dùng một stack cho nhiều job.
// §8.3: totalSuccessPercent = herbAgeBasePercent + roomBonus[level];
// guaranteedPills = floor(total/100); extraPillChance = total % 100.

import type { PillBag } from '../pill/PillBag'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import { SUPPORTED_PROFESSION_REALMS } from '../profession/ProfessionMaterial'
import { REALM_TIERS } from '../realm/RealmTierMap'
import { HERB_AGE_BASE_SUCCESS_PERCENT } from '../production/ProductionBalance'
import { mulberry32 } from '../production/ProductionBalance'

/** Biến thể nguyên liệu của thảo — stack cụ thể trong Bag. */
export interface AlchemyHerbVariant {
  /** Material id đầy đủ (kèm hậu tố niên đại hoặc biến thể legacy). */
  materialId: string

  /** Khóa tra HERB_AGE_BASE_SUCCESS_PERCENT. */
  age: 'decade' | 'century' | 'millennium' | 'myriad_year'

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

  /** Realm TỐI THIỂU của gỗ nhiên liệu — gỗ cao hơn KHÔNG tăng tỷ lệ (MVP §8.1). */
  fuelWoodRealmId: string

  fuelWoodAmount: number

  spiritStoneCost: number

  baseDurationSeconds: number
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
}

export interface AlchemySettlementEvent {
  jobId: string

  pillId: string

  pills: number

  success: boolean
}

export function jobSuccessPercent(
  job: ActiveAlchemyJob,
  recipe: AlchemyRecipe,
  successBonusPercentPoints = 0,
): number {
  const variant = recipe.herbVariants.find((candidate) => candidate.materialId === job.herbMaterialId)

  const base = HERB_AGE_BASE_SUCCESS_PERCENT[variant?.age ?? 'decade']

  const bonus = alchemyRoomSuccessBonus(job.roomLevelAtStart)

  // Thiên phú Đan Duyên — cộng điểm % trước khi tách guaranteed/extra,
  // giữ cap 300 (plan §6).
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
 * Chọn stack gỗ nhiên liệu rẻ nhất đạt realm tối thiểu (realm index
 * tăng dần theo SUPPORTED_PROFESSION_REALMS).
 */
export function resolveFuelWood(
  bag: MaterialBag,
  minRealmId: string,
  amount: number,
): string | null {
  const minIndex = SUPPORTED_PROFESSION_REALMS.indexOf(minRealmId)
  const realmIndex = REALM_TIERS.findIndex(realmId => realmId === minRealmId)

  if (minIndex < 0 && realmIndex < 0) {
    return null
  }

  if (realmIndex >= SUPPORTED_PROFESSION_REALMS.length) {
    const qualities = ['hoang', 'huyen', 'dia', 'thien', 'tien'] as const
    for (let index = realmIndex; index < REALM_TIERS.length; index++) {
      for (const quality of qualities) {
        const candidate = `${REALM_TIERS[index]}_wood_${quality}`
        if (bag.has(candidate, amount)) return candidate
      }
    }
    return null
  }

  for (let index = minIndex; index < SUPPORTED_PROFESSION_REALMS.length; index++) {
    const candidate = `${SUPPORTED_PROFESSION_REALMS[index]}_wood`

    if (bag.has(candidate, amount)) {
      return candidate
    }
  }

  return null
}

export class AlchemySystem {
  private jobs: ActiveAlchemyJob[] = []

  private pendingEvents: AlchemySettlementEvent[] = []

  restoreJobs(jobs: ActiveAlchemyJob[]): void {
    this.jobs = [...jobs]
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
  ): { ok: boolean; reason?: string } {
    if (this.jobs.length >= Math.max(1, maxConcurrentJobs)) {
      return { ok: false, reason: 'job_slots_full' }
    }

    const variant = recipe.herbVariants.find((candidate) => candidate.materialId === herbMaterialId)

    if (!variant) {
      return { ok: false, reason: 'wrong_herb' }
    }

    if (!registry.has(herbMaterialId)) {
      return { ok: false, reason: 'wrong_herb' }
    }

    const woodId = resolveFuelWood(bag, recipe.fuelWoodRealmId, recipe.fuelWoodAmount)

    if (!woodId) {
      return { ok: false, reason: 'missing_fuel_wood' }
    }

    if (!bag.has(herbMaterialId, recipe.herbAmount)) {
      return { ok: false, reason: 'missing_herb' }
    }

    if (spiritStone < recipe.spiritStoneCost) {
      return { ok: false, reason: 'missing_spirit_stone' }
    }

    // Reserve atomic — trừ toàn bộ sau khi mọi check pass.
    bag.remove(herbMaterialId, recipe.herbAmount)

    bag.remove(woodId, recipe.fuelWoodAmount)

    this.jobs.push({
      jobId: nextJobId(),
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId,
      startedAtMs: nowMs,
      completesAtMs: nowMs + alchemySecondsFor(recipe, roomLevel) * 1000,
      roomLevelAtStart: roomLevel,
    })

    return { ok: true }
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
  ): void {
    const remaining: ActiveAlchemyJob[] = []

    for (const job of this.jobs) {
      if (nowMs < job.completesAtMs) {
        remaining.push(job)

        continue
      }

      const recipe = this.recipeLookup?.(job.recipeId)

      const pill = resolvePill(job.pillId)

      if (!recipe || !pill) {
        // Recipe/pill không resolve được (data đổi/xoá giữa save và load) —
        // TRƯỚC ĐÂY job bị xoá im lặng, mất trắng nguyên liệu đã reserve mà
        // không có event nào (review 2026-08-28). Giờ phát event thất bại để
        // UI thông báo; nguyên liệu đã đốt KHÔNG hoàn trả (job coi như luyện
        // thất bại — đúng semantic §8.3, không tạo refund exploit).
        this.pendingEvents.push({ jobId: job.jobId, pillId: job.pillId, pills: 0, success: false })

        continue
      }

      const totalPercent = jobSuccessPercent(job, recipe, successBonusPercentPoints)

      const guaranteedPills = Math.floor(totalPercent / 100)

      const extraPillChance = totalPercent % 100

      let pills = guaranteedPills

      if (random() * 100 < extraPillChance) {
        pills += 1
      }

      if (pills > 0) {
        pillBag.add(pill as Parameters<typeof pillBag.add>[0], pills)
      }

      this.pendingEvents.push({ jobId: job.jobId, pillId: job.pillId, pills, success: pills > 0 })
    }

    this.jobs = remaining
  }

  /** Offline settle — job hoàn thành trong quá khứ settle đúng một lần. */
  settleOffline(
    pillBag: PillBag,
    resolvePill: (pillId: string) => { id: string } | undefined,
    nowMs: number = Date.now(),
    successBonusPercentPoints = 0,
  ): number {
    const before = this.jobs.length

    this.tick(nowMs, pillBag, resolvePill, Math.random, successBonusPercentPoints)

    return before - this.jobs.length
  }

  /** Wiring recipe lookup từ GameManager để tick resolve snapshot recipe. */
  private recipeLookup?: (recipeId: string) => AlchemyRecipe | undefined

  setRecipeLookup(lookup: (recipeId: string) => AlchemyRecipe | undefined): void {
    this.recipeLookup = lookup
  }
}

export { mulberry32 as alchemyMulberry32 }
