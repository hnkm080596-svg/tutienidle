// ProfessionMaterial (2026-08-25, resource-professions-rework plan §5/§6)
// — metadata nghề gắn lên Material cho vòng kinh tế mới: Địa Giới →
// Lâm/Quáng/Động Thiên → Bag → Khí Đường/Đan Phòng. KHÔNG còn cặp
// raw|processed (plan §2). Optional field trên Material nên save cũ /
// material legacy không có metadata vẫn load bình thường.
//
// ID convention:
// - Gỗ: `<realm>_wood`
// - Quáng: `<realm>_ore_<quality>` (quality ∈ hoang..tien)
// - Linh thảo Động Thiên: `<herbBase>_<age>` (age ∈ decade..myriad_year)
// TÊN HIỂN THỊ nằm trong catalog data, KHÔNG parse từ id để lấy tên.

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

/** Metadata nghề trên Material — shape tuỳ kind (§5.3 phẩm Quáng, §6.1 niên đại thảo). */
export interface ProfessionMaterialMeta {
  resourceKind: ResourceKind

  realmId: string

  /** Chỉ Quáng (§5.3) — metadata phẩm, không đổi thời gian cycle. */
  quality?: string

  /** Chỉ Linh thảo Động Thiên (§6.1) — biến thể niên đại. */
  age?: string

  /** Chỉ Linh thảo — đan phương DUY NHẤT mà thảo này nuôi (§6.1). */
  pillRecipeId?: string

  /** Chỉ Linh thảo — base identity chung các biến thể niên đại. */
  herbBaseId?: string
}

/** Guard đầy đủ cho meta Quáng. */
export function isOreProfessionMeta(meta: ProfessionMaterialMeta): boolean {
  return (
    meta.resourceKind === 'ore' &&
    typeof meta.quality === 'string' &&
    ['hoang', 'huyen', 'dia', 'thien', 'tien'].includes(meta.quality)
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
