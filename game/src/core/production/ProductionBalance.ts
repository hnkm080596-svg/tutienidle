// ProductionBalance (plan §4.2/§5.1/§5.3/§6.2) — TOÀN BỘ bảng balance
// của vòng sản xuất nằm tại ĐÂY (balance data, chưa phải số cuối —
// playtest chỉnh tại đây, không sửa system). Engine chỉ enforce THỨ TỰ
// (phẩm cao trọng số thấp hơn), không tự gán con số (§5.3).

import type { HerbAge, OreQuality } from './ProductionTypes'

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
// Quáng (§5.3): phẩm cao trọng số thấp — engine enforce thứ tự
// hoang > huyen > dia > thien > tien về xác suất.
// =========================

export const ORE_QUALITY_WEIGHTS: Record<OreQuality, number> = {
  hoang: 50,
  huyen: 25,
  dia: 14,
  thien: 8,
  tien: 3,
}

/** Số Quáng nhận được theo phẩm (balance data §13.2). */
export const ORE_QUALITY_AMOUNTS: Record<OreQuality, number> = {
  hoang: 3,
  huyen: 2,
  dia: 2,
  thien: 1,
  tien: 1,
}

// =========================
// Linh Thảo (§6.1/§6.2): niên đại cao trọng số thấp; baseline
// 55/28/12/5 là simulation khởi điểm (§13.4).
// =========================

export const HERB_AGE_WEIGHTS: Record<HerbAge, number> = {
  decade: 55,
  century: 28,
  millennium: 12,
  myriad_year: 5,
}

/** Tỷ lệ thành đan cơ sở theo niên đại (§6.2) — trước bonus Đan Phòng. */
export const HERB_AGE_BASE_SUCCESS_PERCENT: Record<HerbAge, number> = {
  decade: 30,
  century: 50,
  millennium: 75,
  myriad_year: 100,
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
