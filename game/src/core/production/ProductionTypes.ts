// ProductionTypes (resource-professions-rework plan sec3/sec4/sec5/sec6) -
// contract cua vong kinh te moi: Dia Gioi -> Lam/Quang/Dong Thien ->
// MaterialBag -> Khi Duong/Dan Phong. Khong con chuoi raw->processed,
// khong con building trung gian.
//
// Quy uoc toa do: realm tier trong Dia Gioi dung TRUC TIEP RealmId
// (mortal/qi_refining/foundation_establishment cho Thanh Van). Trong so
// profile theo "collectionRealmId" snapshot luc bat dau cycle.

export type ProductionSiteKind = 'forest' | 'mine' | 'grotto'

export const PRODUCTION_SITE_KINDS: readonly ProductionSiteKind[] = ['forest', 'mine', 'grotto']

export function isProductionSiteKind(value: unknown): value is ProductionSiteKind {
  return value === 'forest' || value === 'mine' || value === 'grotto'
}

/**
 * Nien dai Linh Thao (plan sec6.1 + gp123 6E task C1) - truc tuoi 5 bac:
 * thuong_co la bac tren cung, trung nhan "Thuong Co" cua he chat thong nhat.
 * gp123 6E (task C2): truc tuoi 5 bac (decade..thuong_co) gio DUNG CHUNG
 * cho Linh Thao, Go va Khoang - hau to pham cu (hoang..tien) va plain
 * wood `<realm>_wood` da bi xoa khoi material catalog (save bump v57).
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

/** Cycle dang chay - moi ket qua reward CHUA roll, chi snapshot dieu kien (sec4.1). */
export interface ProductionCycle {
  cycleId: string

  siteId: string

  /** Canh gioi DANG THU THAP snapshot luc start - quyet dinh deadline + profile trong so. */
  collectionRealmId: string

  siteLevelAtStart: number

  /** Version bang reward - bump khi balance data doi de cycle cu roll theo bang cu. */
  rewardTableVersion: number

  /** RNG seed - roll toan bo reward SAU KHI hoan thanh bang seed nay (sec4.1). */
  rollSeed: number

  startedAtMs: number

  completesAtMs: number
}

export interface ProductionSiteState {
  siteId: string

  level: number

  autoRestart: boolean

  /** Parallel lanes the shared worker pool currently grants this site. */
  activeWorkerSlots: number

  /** In-flight worker lane heads - the ONLY cycle kind (Mission D / spec D3). */
  workerCycles?: ProductionCycle[]

  /** Player-requested assignment; undefined = AUTO (round-robin share). */
  assignedWorkers?: number

  /** M-F-BODY-HIDDEN (spec sec.4) - per-grotto-channel settle-cycle
      counters on THIS site (channelId -> eligible cycles since the
      last emission). Grotto sites only; production-side state because
      ProductionSystem never sees PlayerData (A3). */
  hiddenChannelCycles?: Record<string, number>
}

/** Mot Lam/Quang/Dong Thien cua Dia Gioi (sec3.1). */
export interface ProductionSiteDefinition {
  siteId: string

  territoryId: string

  kind: ProductionSiteKind

  name: string

  description: string

  maxLevel: number

  /** Chi phi nang level N -> N+1, index = level hien tai - 1. Go + Linh Thach. */
  upgradeCosts: Array<{ woodMaterialId: string; woodAmount: number; spiritStone: number }>
}

/** Dia Gioi (sec3.1): dung mot Lam, mot Quang, mot Dong Thien. */
export interface TerritoryDefinition {
  id: string

  name: string

  /** Dung 3 canh gioi, thu tu thap -> cao (local tier low/middle/high). */
  realmIds: readonly [string, string, string]

  productionSiteIds: {
    forest: string

    mine: string

    grotto: string
  }
}

// =========================
// Reward definitions (sec5.2/sec5.3/sec6.1)
// =========================

export interface ForestRewardDefinition {
  materialId: string

  /** Realm tier ma loai go nay thuoc ve trong Dia Gioi. */
  realmId: string

  /** gp123 6E C2: bien the tuoi cua go (thay vi amount co dinh 3/2/1). */
  age: HerbAge

  amount: number
}

export interface MineRewardDefinition {
  materialId: string

  realmId: string

  /** gp123 6E C2: truc tuoi thong nhat (truoc day `quality: OreQuality`). */
  age: HerbAge

  amount: number
}

export interface GrottoHerbDefinition {
  materialId: string

  realmId: string

  /** Dan phuong duy nhat ma thao nay nuoi (sec6.1 - moi recipe 1 thao rieng). */
  pillRecipeId: string

  age: HerbAge
}
