// ProductionBalance (plan sec4.2/sec5.1/sec5.3/sec6.2) - TOAN BO bang balance
// cua vong san xuat nam tai DAY (balance data, chua phai so cuoi -
// playtest chinh tai day, khong sua system). Engine chi enforce THU TU
// (pham cao trong so thap hon), khong tu gan con so (sec5.3).

import { PRODUCTION_SITE_KINDS } from './ProductionTypes'
import type { HerbAge, ProductionSiteKind } from './ProductionTypes'

/**
 * Thoi gian co so theo canh gioi dang thu thap (sec4.2) - baseline tang
 * gap ba moi canh gioi. Bang theo realmId, KHONG hard-code 100x3^n
 * tai call site de sau nay tune tung canh gioi rieng.
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

/** Speed multiplier theo level nguon (sec4.2) - index 0 = level 1. */
export const SITE_SPEED_MULTIPLIERS: readonly number[] = [1.0, 1.15, 1.35, 1.6, 2.0, 2.5, 3.1, 3.8, 4.6]

export function getSiteSpeedMultiplier(level: number): number {
  return SITE_SPEED_MULTIPLIERS[Math.min(Math.max(level, 1), SITE_SPEED_MULTIPLIERS.length) - 1] ?? 1
}

/** cycleSeconds = ceil(base / speed) - nang level giua cycle khong doi cycle dang chay (snapshot levelAtStart). */
export function computeCycleSeconds(baseSeconds: number, siteLevel: number): number {
  return Math.ceil(baseSeconds / getSiteSpeedMultiplier(siteLevel))
}

// =========================
// Trong so realm tier (sec5.1) - Lam/Quang/Dong Thien dung chung.
// `low` tong bang 90 CO Y (60/20/10 la TRONG SO khong phai %);
// resolver chuan hoa tong truoc khi roll.
// =========================

export type TierWeightProfile = readonly [number, number, number]

export const TIER_WEIGHT_PROFILES: Record<'low' | 'middle' | 'high', TierWeightProfile> = {
  low: [60, 20, 10],
  middle: [40, 40, 20],
  high: [20, 40, 40],
}

/** Weight profile resolved from the snapshot collectionRealmId (sec 5.1).
 *  Mission D (spec D2): `-1` is unreachable for cycles written through
 *  resolveTerritoryTier - the clause doubles as corrupt-snapshot defense
 *  and the bottom-tier (index 0) case. Never throws: a poisoned save
 *  must degrade, not crash the tick. */
export function getTierWeightProfile(collectionRealmId: string, territoryRealmIds: readonly string[]): TierWeightProfile {
  const index = territoryRealmIds.indexOf(collectionRealmId)

  if (index <= 0) {
    return TIER_WEIGHT_PROFILES.low
  }

  return index === 1 ? TIER_WEIGHT_PROFILES.middle : TIER_WEIGHT_PROFILES.high
}

// =========================
// Go/Khoang (gp123 6E task C2): truc tuoi thong nhat - bang nay TRUOC
// day la ORE_QUALITY_WEIGHTS/AMOUNTS keyed hoang..tien; gia tri giu
// nguyen 1:1, chi truc key doi sang HerbAge (decade..thuong_co).
// =========================

export const MATERIAL_AGE_WEIGHTS: Record<HerbAge, number> = {
  decade: 50,
  century: 25,
  millennium: 14,
  myriad_year: 8,
  thuong_co: 3,
}

/** So Go/Khoang nhan duoc theo tuoi (balance data sec13.2). */
export const MATERIAL_AGE_AMOUNTS: Record<HerbAge, number> = {
  decade: 3,
  century: 2,
  millennium: 2,
  myriad_year: 1,
  thuong_co: 1,
}

// =========================
// Linh Thao (sec6.1/sec6.2): nien dai cao trong so thap; baseline
// 55/28/12/5/2 la simulation khoi diem (sec13.4) - thuong_co sieu hiem.
// =========================

export const HERB_AGE_WEIGHTS: Record<HerbAge, number> = {
  decade: 55,
  century: 28,
  millennium: 12,
  myriad_year: 5,
  thuong_co: 2,
}

/** Ty le thanh dan co so theo nien dai (sec6.2) - truoc bonus Dan Phong. */
export const HERB_AGE_BASE_SUCCESS_PERCENT: Record<HerbAge, number> = {
  decade: 30,
  century: 50,
  millennium: 75,
  myriad_year: 100,
  thuong_co: 100,
}

/** So thao nhan duoc moi cycle Dong Thien (balance data). */
export const GROTTO_HERB_AMOUNT = 1

// =========================
// Offline (sec4.3): settle tuan tu trong cap; moi auto-cycle seed rieng.
// =========================

export const PRODUCTION_OFFLINE_CAP_SECONDS = 10 * 60 * 60

// =========================
// Bang tong hop suat san xuat (gp123 6F) - PURE DERIVATION tu cac bang
// balance phia tren, KHONG co con so moi: moi hang = mot site-kind trong
// mot canh gioi thu thap, tong hop cycle seconds + yield + trong so
// tuoi + worker model de simulation test (ProductionBalance.simulation
// .test.ts) khoa bat dang thuc "san xuat <= tieu thu tren moi nhan cong".
// Tune balance -> sua cac bang nguon o tren, bang nay tu dong cap nhat.
// =========================

/** Worker model van hanh mot chuoi (6F): site slots / Dan Phong / Phan Giai. */
export type ProductionWorkerModel =
  | 'manual_or_worker_slots'
  | 'dan_phong_jobs'
  | 'decompose_workers'

/** Mot hang cua PRODUCTION_RATE_TABLE - suat cua 1 site-kind/realm (moi cycle). */
export interface ProductionRateRow {
  /** Site kind (forest/mine/grotto). */
  kind: ProductionSiteKind

  /** Canh gioi dang thu thap - quyet dinh cycle seconds. */
  collectionRealmId: string

  /** Giay/cycle level 1 = ceil(base / speed level 1). */
  cycleSeconds: number

  /**
   * Id material thu duoc - `<realm>_wood_<age>` / `<realm>_ore_<age>`;
   * grotto la `<herbBase>_<age>` (herbBase theo dan phuong, sec6.1).
   */
  yieldMaterialIdPattern: string

  /** So luong moi cycle theo tuoi (wood/ore: MATERIAL_AGE_AMOUNTS; grotto: GROTTO_HERB_AMOUNT). */
  yieldAmountByAge: Readonly<Record<HerbAge, number>>

  /** Trong so roll tuoi cua site (grotto dung HERB_AGE_WEIGHTS, con lai MATERIAL_AGE_WEIGHTS). */
  ageRollWeights: Readonly<Record<HerbAge, number>>

  /** Worker model cua chuoi van hanh hang nay. */
  workerModel: ProductionWorkerModel
}

/** GROTTO_HERB_AMOUNT trai deu moi tuoi (moi cycle Dong Thien nhan dung 1 thao). */
const GROTTO_HERB_AMOUNT_RECORD: Readonly<Record<HerbAge, number>> = {
  decade: GROTTO_HERB_AMOUNT,
  century: GROTTO_HERB_AMOUNT,
  millennium: GROTTO_HERB_AMOUNT,
  myriad_year: GROTTO_HERB_AMOUNT,
  thuong_co: GROTTO_HERB_AMOUNT,
}

/** Truc realm cua bang - tu chinh bang cycle seconds (thu tu giu nguyen). */
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
 * Bang xuat ra cho simulation test - flatten moi realm x 3 site-kind.
 * Don vi: so luong moi cycle/worker. So lieu tieu thu Dan Phong/Phan
 * Giai nam o data/alchemy + DecomposeSystem (bang nay chi tong hop
 * chuoi nguon Lam/Quang/Dong Thien).
 */
export const PRODUCTION_RATE_TABLE: readonly ProductionRateRow[] = RATE_TABLE_REALM_IDS.flatMap(
  (realmId) => PRODUCTION_SITE_KINDS.map((kind) => buildRateRow(kind, realmId)),
)

// =========================
// Weighted roll helpers - seeded (mulberry32) de roll SAU khi hoan
// thanh tu seed da snapshot (sec4.1).
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

/** Roll index theo trong so - chuan hoa tong ben trong (tong <= 0 -> -1; non-finite -> throw). */
export function rollWeightedIndex(weights: readonly number[], random: () => number): number {
  let total = 0

  for (const weight of weights) {
    total += Math.max(0, weight)
  }

  // r13-AUT-3: Math.max(0, NaN) stays NaN, so a non-finite weight
  // poisons the sum silently and the fall-through pays the LAST index
  // deterministically. Align with weightedRandom/drawFromPool: fail
  // closed on corrupted authored data.
  if (!Number.isFinite(total)) {
    throw new Error(`rollWeightedIndex: weights must be finite (got total ${total})`)
  }

  // An all-zero pool is a legitimate runtime outcome (realm-gating can
  // cap every entry to 0) - return a sentinel the caller must handle
  // instead of deterministically paying index 0 (fail-open).
  if (total <= 0) {
    return -1
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
