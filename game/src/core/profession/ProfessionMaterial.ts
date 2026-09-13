// ProfessionMaterial (2026-08-25, resource-professions-rework plan §5/§6)
// — metadata nghề gắn lên Material cho vòng kinh tế mới: Địa Giới →
// Lâm/Quáng/Động Thiên → Bag → Khí Đường/Đan Phòng. KHÔNG còn cặp
// raw|processed (plan §2). Optional field trên Material nên save cũ /
// material legacy không có metadata vẫn load bình thường.
//
// ID convention (gp123 6E task C2 — trục tuổi thống nhất):
// - Gỗ: `<realm>_wood_<age>` (age ∈ decade..thuong_co; plain
//   `<realm>_wood` và hậu tố phẩm hoang..tien đã XÓA)
// - Quáng: `<realm>_ore_<age>`
// - Linh thảo Động Thiên: `<herbBase>_<age>`
// TÊN HIỂN THỊ nằm trong catalog data, KHÔNG parse từ id để lấy tên.

import type { HerbAge } from '../production/ProductionTypes'
import { HERB_AGES } from '../production/ProductionTypes'

export type ResourceKind = 'herb' | 'wood' | 'ore'

export const RESOURCE_KINDS: readonly ResourceKind[] = ['herb', 'wood', 'ore']

export function isResourceKind(value: unknown): value is ResourceKind {
  return value === 'herb' || value === 'wood' || value === 'ore'
}

/**
 * Product scope hiện tại (plan §3.1): chỉ Địa Giới Thanh Vân với ba
 * cảnh giới Phàm Nhân/Luyện Khí/Trúc Cơ. Contract dùng catalog để mở
 * rộng sau này mà không sửa engine.
 */
export const SUPPORTED_PROFESSION_REALMS: readonly string[] = [
  'mortal',
  'qi_refining',
  'foundation_establishment',
]

/** Metadata nghề trên Material — shape tuỳ kind (§5.3/§6.1 + 6E C2: gỗ/khoáng dùng `age`). */
export interface ProfessionMaterialMeta {
  resourceKind: ResourceKind

  realmId: string

  /** gp123 6E C2: gỗ/khoáng/thảo đều dùng trục tuổi thống nhất. */
  age?: HerbAge

  /** Chỉ Linh thảo — đan phương DUY NHẤT mà thảo này nuôi (§6.1). */
  pillRecipeId?: string

  /** Chỉ Linh thảo — base identity chung các biến thể niên đại. */
  herbBaseId?: string
}

/** Guard đầy đủ cho meta Gỗ/Khoáng — trục tuổi 5 bậc thống nhất (6E C2). */
export function isProfessionResourceMeta(meta: ProfessionMaterialMeta): boolean {
  return (
    (meta.resourceKind === 'wood' || meta.resourceKind === 'ore') &&
    typeof meta.age === 'string' &&
    HERB_AGES.includes(meta.age)
  )
}

/** Guard đầy đủ cho meta Linh thảo Động Thiên. */
export function isHerbProfessionMeta(meta: ProfessionMaterialMeta): boolean {
  return (
    meta.resourceKind === 'herb' &&
    typeof meta.age === 'string' &&
    typeof meta.pillRecipeId === 'string' &&
    typeof meta.herbBaseId === 'string'
  )
}