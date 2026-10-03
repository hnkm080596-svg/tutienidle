// ProfessionMaterial (2026-08-25, resource-professions-rework plan sec5/sec6)
// - metadata nghe gan len Material cho vong kinh te moi: Dia Gioi ->
// Lam/Quang/Dong Thien -> Bag -> Khi Duong/Dan Phong. KHONG con cap
// raw|processed (plan sec2). Optional field tren Material nen save cu /
// material legacy khong co metadata van load binh thuong.
//
// ID convention (gp123 6E task C2 - truc tuoi thong nhat):
// - Go: `<realm>_wood_<age>` (age in decade..thuong_co; plain
//   `<realm>_wood` va hau to pham hoang..tien da XOA)
// - Quang: `<realm>_ore_<age>`
// - Linh thao Dong Thien: `<herbBase>_<age>`
// TEN HIEN THI nam trong catalog data, KHONG parse tu id de lay ten.

import type { HerbAge } from '../production/ProductionTypes'
import { HERB_AGES } from '../production/ProductionTypes'

export type ResourceKind = 'herb' | 'wood' | 'ore'

export const RESOURCE_KINDS: readonly ResourceKind[] = ['herb', 'wood', 'ore']

export function isResourceKind(value: unknown): value is ResourceKind {
  return value === 'herb' || value === 'wood' || value === 'ore'
}

/**
 * Product scope hien tai (plan sec3.1): chi Dia Gioi Thanh Van voi ba
 * canh gioi Pham Nhan/Luyen Khi/Truc Co. Contract dung catalog de mo
 * rong sau nay ma khong sua engine.
 */
export const SUPPORTED_PROFESSION_REALMS: readonly string[] = [
  'mortal',
  'qi_refining',
  'foundation_establishment',
]

/** Metadata nghe tren Material - shape tuy kind (sec5.3/sec6.1 + 6E C2: go/khoang dung `age`). */
export interface ProfessionMaterialMeta {
  resourceKind: ResourceKind

  realmId: string

  /** gp123 6E C2: go/khoang/thao deu dung truc tuoi thong nhat. */
  age?: HerbAge

  /** Chi Linh thao - dan phuong DUY NHAT ma thao nay nuoi (sec6.1). */
  pillRecipeId?: string

  /** Chi Linh thao - base identity chung cac bien the nien dai. */
  herbBaseId?: string
}

/**
 * Authoritative wood/ore (Go/Quang) id constructor - `<realmId>_<kind>_<age>`.
 * Parsers (DecomposeSystem ORE_ID_PATTERN) mirror this grammar.
 */
export function buildProfessionMaterialId(
  resourceKind: 'wood' | 'ore',
  realmId: string,
  age: HerbAge,
): string {
  return `${realmId}_${resourceKind}_${age}`
}

/** Linh thao base identity chung cac bien the nien dai - `<herbId>_<realmId>`. */
export function herbBaseId(herbId: string, realmId: string): string {
  return `${herbId}_${realmId}`
}

/** Linh thao variant id - `<herbBaseId>_<age>`. */
export function herbMaterialId(baseId: string, age: HerbAge): string {
  return `${baseId}_${age}`
}

/** Guard day du cho meta Go/Khoang - truc tuoi 5 bac thong nhat (6E C2). */
export function isProfessionResourceMeta(meta: ProfessionMaterialMeta): boolean {
  return (
    (meta.resourceKind === 'wood' || meta.resourceKind === 'ore') &&
    typeof meta.age === 'string' &&
    HERB_AGES.includes(meta.age)
  )
}

/** Guard day du cho meta Linh thao Dong Thien. */
export function isHerbProfessionMeta(meta: ProfessionMaterialMeta): boolean {
  return (
    meta.resourceKind === 'herb' &&
    typeof meta.age === 'string' &&
    typeof meta.pillRecipeId === 'string' &&
    typeof meta.herbBaseId === 'string'
  )
}