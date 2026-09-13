// ProductionTypes (resource-professions-rework plan §3/§4/§5/§6) —
// contract của vòng kinh tế mới: Địa Giới → Lâm/Quáng/Động Thiên →
// MaterialBag → Khí Đường/Đan Phòng. Không còn chuỗi raw→processed,
// không còn building trung gian.
//
// Quy ước tọa độ: realm tier trong Địa Giới dùng TRỰC TIẾP RealmId
// (mortal/qi_refining/foundation_establishment cho Thanh Vân). Trọng số
// profile theo "collectionRealmId" snapshot lúc bắt đầu cycle.

export type ProductionSiteKind = 'forest' | 'mine' | 'grotto'

export const PRODUCTION_SITE_KINDS: readonly ProductionSiteKind[] = ['forest', 'mine', 'grotto']

export function isProductionSiteKind(value: unknown): value is ProductionSiteKind {
  return value === 'forest' || value === 'mine' || value === 'grotto'
}

/**
 * Niên đại Linh Thảo (plan §6.1 + gp123 6E task C1) — trục tuổi 5 bậc:
 * thuong_co là bậc trên cùng, trùng nhãn "Thượng Cổ" của hệ chất thống nhất.
 * gp123 6E (task C2): trục tuổi 5 bậc (decade..thuong_co) giờ DÙNG CHUNG
 * cho Linh Thảo, Gỗ và Khoáng — hậu tố phẩm cũ (hoang..tien) và plain
 * wood `<realm>_wood` đã bị xóa khỏi material catalog (save bump v57).
 */
export type HerbAge = 'decade' | 'century' | 'millennium' | 'myriad_year' | 'thuong_co'

export const HERB_AGES: readonly HerbAge[] = [
  'decade',
  'century',
  'millennium',
  'myriad_year',
  'thuong_co',
]

export function isHerbAge(value: unknown): value is HerbAge {
  return (
    value === 'decade' ||
    value === 'century' ||
    value === 'millennium' ||
    value === 'myriad_year' ||
    value === 'thuong_co'
  )
}

/** Cycle đang chạy — mọi kết quả reward CHƯA roll, chỉ snapshot điều kiện (§4.1). */
export interface ProductionCycle {
  cycleId: string

  siteId: string

  /** Cảnh giới ĐANG THU THẬP snapshot lúc start — quyết định deadline + profile trọng số. */
  collectionRealmId: string

  siteLevelAtStart: number

  /** Version bảng reward — bump khi balance data đổi để cycle cũ roll theo bảng cũ. */
  rewardTableVersion: number

  /** RNG seed — roll toàn bộ reward SAU KHI hoàn thành bằng seed này (§4.1). */
  rollSeed: number

  startedAtMs: number

  completesAtMs: number
}

export interface ProductionSiteState {
  siteId: string

  level: number

  autoRestart: boolean

  /** Số cycle song song hiện được pool nhân công toàn cục cấp cho site. */
  activeWorkerSlots: number

  activeCycle?: ProductionCycle

  /** Các cycle bổ sung do worker 2+ vận hành. */
  workerCycles?: ProductionCycle[]

  /** Chi-hien-quan spec (2026-09-02): số slot MANUAL gán cho site.
   *  undefined = site chạy AUTO (round-robin phần dư capacity). */
  assignedWorkers?: number
}

/** Một Lâm/Quáng/Động Thiên của Địa Giới (§3.1). */
export interface ProductionSiteDefinition {
  siteId: string

  territoryId: string

  kind: ProductionSiteKind

  name: string

  description: string

  maxLevel: number

  /** Chi phí nâng level N → N+1, index = level hiện tại - 1. Gỗ + Linh Thạch. */
  upgradeCosts: Array<{ woodMaterialId: string; woodAmount: number; spiritStone: number }>
}

/** Địa Giới (§3.1): đúng một Lâm, một Quáng, một Động Thiên. */
export interface TerritoryDefinition {
  id: string

  name: string

  /** Đúng 3 cảnh giới, thứ tự thấp → cao (local tier low/middle/high). */
  realmIds: readonly [string, string, string]

  productionSiteIds: {
    forest: string

    mine: string

    grotto: string
  }
}

// =========================
// Reward definitions (§5.2/§5.3/§6.1)
// =========================

export interface ForestRewardDefinition {
  materialId: string

  /** Realm tier mà loại gỗ này thuộc về trong Địa Giới. */
  realmId: string

  /** gp123 6E C2: biến thể tuổi của gỗ (thay vì amount cố định 3/2/1). */
  age: HerbAge

  amount: number
}

export interface MineRewardDefinition {
  materialId: string

  realmId: string

  /** gp123 6E C2: trục tuổi thống nhất (trước đây `quality: OreQuality`). */
  age: HerbAge

  amount: number
}

export interface GrottoHerbDefinition {
  materialId: string

  realmId: string

  /** Đan phương duy nhất mà thảo này nuôi (§6.1 — mỗi recipe 1 thảo riêng). */
  pillRecipeId: string

  age: HerbAge
}
