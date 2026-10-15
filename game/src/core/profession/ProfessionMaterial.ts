// Resource identity has two distinct contracts: wood/ore carry age only,
// while herbs retain recipe, realm and age. Display labels live in data.

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

  realmId?: string

  /** gp123 6E C2: go/khoang/thao deu dung truc tuoi thong nhat. */
  age?: HerbAge

  /** Chi Linh thao - dan phuong DUY NHAT ma thao nay nuoi (sec6.1). */
  pillRecipeId?: string

  /** Chi Linh thao - base identity chung cac bien the nien dai. */
  herbBaseId?: string
}

/** Authoritative identity constructor for the fresh age-only resource table. */
export function buildProfessionMaterialId(
  resourceKind: 'wood' | 'ore',
  age: HerbAge,
): string {
  return `material_spirit_${resourceKind}_${age}`
}

/** Canonical resource identity carries age only; realms belong to herbs. */
export function parseProfessionResourceId(resourceKind: 'wood' | 'ore', id: string): HerbAge | null {
  return HERB_AGES.find(age => buildProfessionMaterialId(resourceKind, age) === id) ?? null
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
