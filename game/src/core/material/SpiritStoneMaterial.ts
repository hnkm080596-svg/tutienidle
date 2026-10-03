import type { Material } from './Material'

// Linh Thach la MATERIAL (plan Workstream F) - KHONG con currency state
// rieng tren PlayerData. So du duy nhat:
//   materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
// Cong bang materialBag.add(); tieu bang materialBag.remove() sau khi
// kiem tra has(). Voi penalty co the tru qua so du, dung amount thuc te
// Math.min(owned, requested).
export type SpiritStoneTier = 'ha_pham' | 'trung_pham' | 'thuong_pham'

export const SPIRIT_STONE_MATERIAL_ID = 'spirit_stone_ha_pham'
export const SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID = 'spirit_stone_trung_pham'
export const SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID = 'spirit_stone_thuong_pham'

export const SPIRIT_STONE_MATERIAL: Material = {
  id: SPIRIT_STONE_MATERIAL_ID,

  name: 'Hạ phẩm Linh Thạch',

  category: 'spirit_stone',

  sourceType: 'building',

  description: 'Tinh thể linh khí dùng làm vật liệu và đơn vị trao đổi.',

  // Tran stack chung (MAX_STACK_AMOUNT = 1000) KHONG phu hop Linh Thach
  // - chi phi Dot Pha len toi hang ty. undefined voi material khac =
  // tran chung.
  stackLimit: Number.MAX_SAFE_INTEGER,
}

export const SPIRIT_STONE_TRUNG_PHAM_MATERIAL: Material = {
  ...SPIRIT_STONE_MATERIAL,
  id: SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID,
  name: 'Trung phẩm Linh Thạch',
}

export const SPIRIT_STONE_THUONG_PHAM_MATERIAL: Material = {
  ...SPIRIT_STONE_MATERIAL,
  id: SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID,
  name: 'Thượng phẩm Linh Thạch',
}

export const SPIRIT_STONE_MATERIALS: readonly Material[] = [
  SPIRIT_STONE_MATERIAL,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL,
  SPIRIT_STONE_THUONG_PHAM_MATERIAL,
]

export function getSpiritStoneMaterialIdForRealmTier(tier: number): string {
  if (tier >= 7) return SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID
  if (tier >= 4) return SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID
  return SPIRIT_STONE_MATERIAL_ID
}

/** Moi 30 cap Cuong Hoa chuyen sang mot pham Linh Thach cao hon. */
export function getSpiritStoneMaterialIdForEnhanceLevel(level: number): string {
  if (level >= 60) return SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID
  if (level >= 30) return SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID
  return SPIRIT_STONE_MATERIAL_ID
}

// =========================
// Quy doi pham (review 2026-08-28, economy-ecosystem-plan T2): CHI co
// quy doi 1 CHIEU LEN - 100 Ha -> 1 Trung, 100 Trung -> 1 Thuong. Khong
// co chieu nguoc de giu sink (Linh Thach thuong pham khong bi thao ra
// lai thanh 100 ha pham bypass chi phi).
// gp123 6G (2026-09-06):getNextSpiritStoneMaterialId da bi XOA cung API
// quy doi (GameManager.convertSpiritStonesUp/convertMaterialTier) -
// thu mua theo gate pham thay the. SPIRIT_STONE_CONVERSION_RATIO giu
// lai: TuLinhTranBalance van dung lam he so quy doi gia (xem
// core/economy/TuLinhTranBalance.ts).
// =========================

export const SPIRIT_STONE_CONVERSION_RATIO = 100
