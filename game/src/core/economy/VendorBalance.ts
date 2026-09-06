// VendorBalance (economy-fixes-sinks-plan §3.2 B2, 2026-08-29) — bảng giá
// Hóa Bán của Vendor (bán nguyên liệu thừa lấy Linh Thạch). MỌI giá là
// ĐƠN VỊ HẠ TƯƠNG ĐƯƠNG (hạ phẩm Linh Thạch), caller quy đổi ra phẩm
// Linh Thạch đúng theo realm (xem VendorSystem.ts).
//
// Nguồn realm của 1 material: meta nghề `profession.realmId` (herb/wood/
// ore) — realmIndex quyết định hệ số nhân VENDOR_REALM_GROWTH. Essence/
// byproduct không có meta đủ tốt thì fallback theo realmId truyền vào.
import type { Material } from '../material/Material'
import { getRealmTier } from '../realm/RealmTierMap'
import type { HerbAge } from '../production/ProductionTypes'

/** Danh mục material category được phép bán cho Vendor. */
export const VENDOR_SELLABLE_CATEGORIES = [
  'herb',
  'wood',
  'ore',
  'essence',
  'byproduct',
] as const

export type VendorSellableCategory = (typeof VENDOR_SELLABLE_CATEGORIES)[number]

/** Giá herb (hạ tương đương) theo biến thể niên đại — thuong_co bậc 6E. */
export const VENDOR_HERB_PRICES: Record<string, number> = {
  decade: 2,
  century: 4,
  millennium: 8,
  myriad_year: 16,
  thuong_co: 32,
}

/** Giá gỗ (hạ tương đương) theo tuổi (gp123 6E C2 — giá trị giữ nguyên từ bảng theo phẩm). */
export const VENDOR_WOOD_PRICES: Record<HerbAge, number> = {
  decade: 2,
  century: 5,
  millennium: 12,
  myriad_year: 30,
  thuong_co: 75,
}

/** Giá quáng (hạ tương đương) theo tuổi (gp123 6E C2 — giá trị giữ nguyên từ bảng theo phẩm). */
export const VENDOR_ORE_PRICES: Record<HerbAge, number> = {
  decade: 3,
  century: 8,
  millennium: 20,
  myriad_year: 50,
  thuong_co: 120,
}

/** Giá nền Tinh Hoa (essence) — nhân theo index realm trong essence tier. */
export const VENDOR_ESSENCE_PRICE_BASE = 5

/** Giá nền phế liệu (byproduct). */
export const VENDOR_BYPRODUCT_PRICE_BASE = 1

/** Hệ số nhân giá mỗi bậc realm tier. */
export const VENDOR_REALM_GROWTH = 3

/** Thứ tự realm dùng định giá Luyện Khí Tinh Hoa theo bối cảnh bán. */
const ESSENCE_REALM_ORDER: readonly string[] = [
  'mortal',
  'qi_refining',
  'foundation_establishment',
  'golden_core',
  'nascent_soul',
  'soul_transformation',
  'void_refinement',
  'mahayana',
  'body_integration',
  'tribulation',
]

/**
 * Hệ số nhân theo realm CỦA MATERIAL (meta nghề) — giá trị là thuộc tính
 * nội tại của nguyên liệu. Material không có meta realm (essence/byproduct
 * data mới) thì fallback theo realmId truyền vào.
 */
function realmGrowthFactor(material: Material, realmId: string): number {
  const tier = getRealmTier(material.profession?.realmId ?? realmId)

  return Math.pow(VENDOR_REALM_GROWTH, tier - 1)
}

/**
 * Đơn giá bán (hạ tương đương) của 1 material theo realm truyền vào —
 * undefined nếu material KHÔNG nằm trong danh mục bán được.
 */
export function getUnitSellPrice(material: Material, realmId: string): number | undefined {
  const category = material.category

  if (!(VENDOR_SELLABLE_CATEGORIES as readonly string[]).includes(category)) {
    return undefined
  }

  const meta = material.profession

  const factor = realmGrowthFactor(material, realmId)

  switch (category) {
    case 'herb': {
      const age = meta?.age

      if (!age) {
        return undefined
      }

      const base = VENDOR_HERB_PRICES[age]

      return base === undefined ? undefined : base * factor
    }

    case 'wood':
    case 'ore': {
      const age = meta?.age

      if (!age) {
        return undefined
      }

      const base = category === 'wood' ? VENDOR_WOOD_PRICES[age] : VENDOR_ORE_PRICES[age]

      return base === undefined ? undefined : base * factor
    }

    case 'essence': {
      const index = ESSENCE_REALM_ORDER.indexOf(meta?.realmId ?? realmId)

      // Realm ngoài thang essence tier (không thể xảy ra với REALM_TIERS
      // hiện có) → fallback tier thấp nhất thay vì giá 0.
      const tierIndex = Math.max(0, index)

      return VENDOR_ESSENCE_PRICE_BASE * Math.pow(VENDOR_REALM_GROWTH, tierIndex)
    }

    case 'byproduct':
      return VENDOR_BYPRODUCT_PRICE_BASE * factor
  }
}
