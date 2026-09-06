// ProductionBalance (plan §4.2/§5.1/§5.3/§6.2) — TOÀN BỘ bảng balance
// của vòng sản xuất nằm tại ĐÂY (balance data, chưa phải số cuối —
// playtest chỉnh tại đây, không sửa system). Engine chỉ enforce THỨ TỰ
// (phẩm cao trọng số thấp hơn), không tự gán con số (§5.3).

import { PRODUCTION_SITE_KINDS } from './ProductionTypes'
import type { HerbAge, ProductionSiteKind } from './ProductionTypes'

/**
 * Thời gian cơ sở theo cảnh giới đang thu thập (§4.2) — baseline tăng
 * gấp ba mỗi cảnh giới. Bảng theo realmId, KHÔNG hard-code 100×3^n
 * tại call site để sau này tune từng cảnh giới riêng.
 */
export const CYCLE_BASE_SECONDS_BY_REALM: Record<string, number> = {
  mortal: 100,
  qi_refining: 300,
  foundation_establishment: 900,
  golden_core: 2700,
  nascent_soul: 8100,
  soul_transformation: 24300,
  void_refinement: 72900,
  body_integration: 218700,
  mahayana: 218700,
  tribulation: 656100,
}

/** Speed multiplier theo level nguồn (§4.2) — index 0 = level 1. */
export const SITE_SPEED_MULTIPLIERS: readonly number[] = [1.0, 1.15, 1.35, 1.6, 2.0, 2.5, 3.1, 3.8, 4.6]

export function getSiteSpeedMultiplier(level: number): number {
  return SITE_SPEED_MULTIPLIERS[Math.min(Math.max(level, 1), SITE_SPEED_MULTIPLIERS.length) - 1] ?? 1
}

/** cycleSeconds = ceil(base / speed) — nâng level giữa cycle không đổi cycle đang chạy (snapshot levelAtStart). */
export function computeCycleSeconds(baseSeconds: number, siteLevel: number): number {
  return Math.ceil(baseSeconds / getSiteSpeedMultiplier(siteLevel))
}

// =========================
// Trọng số realm tier (§5.1) — Lâm/Quáng/Động Thiên dùng chung.
// `low` tổng bằng 90 CỐ Ý (60/20/10 là TRỌNG SỐ không phải %);
// resolver chuẩn hoá tổng trước khi roll.
// =========================

export type TierWeightProfile = readonly [number, number, number]

export const TIER_WEIGHT_PROFILES: Record<'low' | 'middle' | 'high', TierWeightProfile> = {
  low: [60, 20, 10],
  middle: [40, 40, 20],
  high: [20, 40, 40],
}

/** Profile trọng số lấy từ collectionRealmId đã snapshot (§5.1). */
export function getTierWeightProfile(collectionRealmId: string, territoryRealmIds: readonly string[]): TierWeightProfile {
  const index = territoryRealmIds.indexOf(collectionRealmId)

  if (index <= 0) {
    return TIER_WEIGHT_PROFILES.low
  }

  return index === 1 ? TIER_WEIGHT_PROFILES.middle : TIER_WEIGHT_PROFILES.high
}

// =========================
// Gỗ/Khoáng (gp123 6E task C2): trục tuổi thống nhất — bảng này TRƯỚC
// đây là ORE_QUALITY_WEIGHTS/AMOUNTS keyed hoang..tien; giá trị giữ
// nguyên 1:1, chỉ trục key đổi sang HerbAge (decade..thuong_co).
// =========================

export const MATERIAL_AGE_WEIGHTS: Record<HerbAge, number> = {
  decade: 50,
  century: 25,
  millennium: 14,
  myriad_year: 8,
  thuong_co: 3,
}

/** Số Gỗ/Khoáng nhận được theo tuổi (balance data §13.2). */
export const MATERIAL_AGE_AMOUNTS: Record<HerbAge, number> = {
  decade: 3,
  century: 2,
  millennium: 2,
  myriad_year: 1,
  thuong_co: 1,
}

// =========================
// Linh Thảo (§6.1/§6.2): niên đại cao trọng số thấp; baseline
// 55/28/12/5/2 là simulation khởi điểm (§13.4) — thuong_co siêu hiếm.
// =========================

export const HERB_AGE_WEIGHTS: Record<HerbAge, number> = {
  decade: 55,
  century: 28,
  millennium: 12,
  myriad_year: 5,
  thuong_co: 2,
}

/** Tỷ lệ thành đan cơ sở theo niên đại (§6.2) — trước bonus Đan Phòng. */
export const HERB_AGE_BASE_SUCCESS_PERCENT: Record<HerbAge, number> = {
  decade: 30,
  century: 50,
  millennium: 75,
  myriad_year: 100,
  thuong_co: 100,
}

/** Số thảo nhận được mỗi cycle Động Thiên (balance data). */
export const GROTTO_HERB_AMOUNT = 1

/** Số gỗ nhận được theo tier (balance data §13.2). */
export const FOREST_WOOD_AMOUNTS_BY_TIER_INDEX: readonly number[] = [3, 2, 1]

// =========================
// Offline (§4.3): settle tuần tự trong cap; mỗi auto-cycle seed riêng.
// =========================

export const PRODUCTION_OFFLINE_CAP_SECONDS = 10 * 60 * 60

// =========================
// Bảng tổng hợp suất sản xuất (gp123 6F) — PURE DERIVATION từ các bảng
// balance phía trên, KHÔNG có con số mới: mỗi hàng = một site-kind trong
// một cảnh giới thu thập, tổng hợp cycle seconds + yield + trọng số
// tuổi + worker model để simulation test (ProductionBalance.simulation
// .test.ts) khoá bất đẳng thức "sản xuất ≤ tiêu thụ trên mỗi nhân công".
// Tune balance → sửa các bảng nguồn ở trên, bảng này tự động cập nhật.
// =========================

/** Worker model vận hành một chuỗi (6F): site slots / Đan Phòng / Phân Giải. */
export type ProductionWorkerModel =
  | 'manual_or_worker_slots'
  | 'dan_phong_jobs'
  | 'decompose_workers'

/** Một hàng của PRODUCTION_RATE_TABLE — suất của 1 site-kind/realm (mỗi cycle). */
export interface ProductionRateRow {
  /** Site kind (forest/mine/grotto). */
  kind: ProductionSiteKind

  /** Cảnh giới đang thu thập — quyết định cycle seconds. */
  collectionRealmId: string

  /** Giây/cycle level 1 = ceil(base / speed level 1). */
  cycleSeconds: number

  /**
   * Id material thu được — `<realm>_wood_<age>` / `<realm>_ore_<age>`;
   * grotto là `<herbBase>_<age>` (herbBase theo đan phương, §6.1).
   */
  yieldMaterialIdPattern: string

  /** Số lượng mỗi cycle theo tuổi (wood/ore: MATERIAL_AGE_AMOUNTS; grotto: GROTTO_HERB_AMOUNT). */
  yieldAmountByAge: Readonly<Record<HerbAge, number>>

  /** Trọng số roll tuổi của site (grotto dùng HERB_AGE_WEIGHTS, còn lại MATERIAL_AGE_WEIGHTS). */
  ageRollWeights: Readonly<Record<HerbAge, number>>

  /** Worker model của chuỗi vận hành hàng này. */
  workerModel: ProductionWorkerModel
}

/** GROTTO_HERB_AMOUNT trải đều mọi tuổi (mỗi cycle Động Thiên nhận đúng 1 thảo). */
const GROTTO_HERB_AMOUNT_RECORD: Readonly<Record<HerbAge, number>> = {
  decade: GROTTO_HERB_AMOUNT,
  century: GROTTO_HERB_AMOUNT,
  millennium: GROTTO_HERB_AMOUNT,
  myriad_year: GROTTO_HERB_AMOUNT,
  thuong_co: GROTTO_HERB_AMOUNT,
}

/** Trục realm của bảng — từ chính bảng cycle seconds (thứ tự giữ nguyên). */
const RATE_TABLE_REALM_IDS: readonly string[] = Object.keys(CYCLE_BASE_SECONDS_BY_REALM)

function buildRateRow(kind: ProductionSiteKind, collectionRealmId: string): ProductionRateRow {
  const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM[collectionRealmId]

  if (!baseSeconds) {
    throw new Error(`ProductionBalance: CYCLE_BASE_SECONDS_BY_REALM thiếu realm ${collectionRealmId}`)
  }

  if (kind === 'grotto') {
    return {
      kind,
      collectionRealmId,
      cycleSeconds: computeCycleSeconds(baseSeconds, 1),
      yieldMaterialIdPattern: '<herbBase>_<age>',
      yieldAmountByAge: GROTTO_HERB_AMOUNT_RECORD,
      ageRollWeights: HERB_AGE_WEIGHTS,
      workerModel: 'manual_or_worker_slots',
    }
  }

  return {
    kind,
    collectionRealmId,
    cycleSeconds: computeCycleSeconds(baseSeconds, 1),
    yieldMaterialIdPattern:
      kind === 'forest' ? `${collectionRealmId}_wood_<age>` : `${collectionRealmId}_ore_<age>`,
    yieldAmountByAge: MATERIAL_AGE_AMOUNTS,
    ageRollWeights: MATERIAL_AGE_WEIGHTS,
    workerModel: 'manual_or_worker_slots',
  }
}

/**
 * Bảng xuất ra cho simulation test — flatten mọi realm × 3 site-kind.
 * Đơn vị: số lượng mỗi cycle/worker. Số liệu tiêu thụ Đan Phòng/Phân
 * Giải nằm ở data/alchemy + DecomposeSystem (bảng này chỉ tổng hợp
 * chuỗi nguồn Lâm/Quáng/Động Thiên).
 */
export const PRODUCTION_RATE_TABLE: readonly ProductionRateRow[] = RATE_TABLE_REALM_IDS.flatMap(
  (realmId) => PRODUCTION_SITE_KINDS.map((kind) => buildRateRow(kind, realmId)),
)

// =========================
// Weighted roll helpers — seeded (mulberry32) để roll SAU khi hoàn
// thành từ seed đã snapshot (§4.1).
// =========================

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5

    let t = state

    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Roll index theo trọng số — chuẩn hoá tổng bên trong (weights rỗng/tổng 0 → 0). */
export function rollWeightedIndex(weights: readonly number[], random: () => number): number {
  let total = 0

  for (const weight of weights) {
    total += Math.max(0, weight)
  }

  if (total <= 0) {
    return 0
  }

  let roll = random() * total

  for (let index = 0; index < weights.length; index++) {
    roll -= Math.max(0, weights[index] ?? 0)

    if (roll < 0) {
      return index
    }
  }

  return weights.length - 1
}
