// VendorBalance (economy-fixes-sinks-plan sec3.2 B2, 2026-08-29) - bang gia
// Hoa Ban cua Vendor (ban nguyen lieu thua lay Linh Thach). MOI gia la
// DON VI HA TUONG DUONG (ha pham Linh Thach), caller quy doi ra pham
// Linh Thach dung theo realm (xem VendorSystem.ts).
//
// Nguon realm cua 1 material: meta nghe `profession.realmId` (herb/wood/
// ore) - realmIndex quyet dinh he so nhan VENDOR_REALM_GROWTH. Essence/
// byproduct khong co meta du tot thi fallback theo realmId truyen vao.
import type { Material } from '../material/Material'
import { getRealmTier } from '../realm/RealmTierMap'
import type { HerbAge } from '../production/ProductionTypes'

/** Danh muc material category duoc phep ban cho Vendor. */
export const VENDOR_SELLABLE_CATEGORIES = [
  'herb',
  'wood',
  'ore',
  'essence',
  'byproduct',
] as const

export type VendorSellableCategory = (typeof VENDOR_SELLABLE_CATEGORIES)[number]

/** Gia herb (ha tuong duong) theo bien the nien dai - thuong_co bac 6E. */
export const VENDOR_HERB_PRICES: Record<string, number> = {
  decade: 2,
  century: 4,
  millennium: 8,
  myriad_year: 16,
  thuong_co: 32,
}

/** Gia go (ha tuong duong) theo tuoi (gp123 6E C2 - gia tri giu nguyen tu bang theo pham). */
export const VENDOR_WOOD_PRICES: Record<HerbAge, number> = {
  decade: 2,
  century: 5,
  millennium: 12,
  myriad_year: 30,
  thuong_co: 75,
}

/** Gia quang (ha tuong duong) theo tuoi (gp123 6E C2 - gia tri giu nguyen tu bang theo pham). */
export const VENDOR_ORE_PRICES: Record<HerbAge, number> = {
  decade: 3,
  century: 8,
  millennium: 20,
  myriad_year: 50,
  thuong_co: 120,
}

/** Gia nen Tinh Hoa (essence) - nhan theo index realm trong essence tier. */
export const VENDOR_ESSENCE_PRICE_BASE = 5

/** Gia nen phe lieu (byproduct). */
export const VENDOR_BYPRODUCT_PRICE_BASE = 1

/** He so nhan gia moi bac realm tier. */
export const VENDOR_REALM_GROWTH = 3

/**
 * He so nhan theo realm CUA MATERIAL (meta nghe) - gia tri la thuoc tinh
 * noi tai cua nguyen lieu. Material khong co meta realm (essence/byproduct
 * data moi) thi fallback theo realmId truyen vao.
 */
function realmGrowthFactor(material: Material, realmId: string): number {
  const tier = getRealmTier(material.profession?.realmId ?? realmId)

  return Math.pow(VENDOR_REALM_GROWTH, tier - 1)
}

/**
 * Don gia ban (ha tuong duong) cua 1 material theo realm truyen vao -
 * undefined neu material KHONG nam trong danh muc ban duoc.
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
      // Same realm-tier authority as realmGrowthFactor - an out-of-range
      // realm (impossible with the current REALM_TIERS) falls back to
      // the lowest tier via getRealmTier -> 1.
      const tierIndex = Math.max(0, getRealmTier(meta?.realmId ?? realmId) - 1)

      return VENDOR_ESSENCE_PRICE_BASE * Math.pow(VENDOR_REALM_GROWTH, tierIndex)
    }

    case 'byproduct':
      return VENDOR_BYPRODUCT_PRICE_BASE * factor
  }
}
