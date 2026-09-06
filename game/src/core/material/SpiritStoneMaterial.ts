import type { Material } from './Material'

// Linh Thạch là MATERIAL (plan Workstream F) — KHÔNG còn currency state
// riêng trên PlayerData. Số dư duy nhất:
//   materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
// Cộng bằng materialBag.add(); tiêu bằng materialBag.remove() sau khi
// kiểm tra has(). Với penalty có thể trừ quá số dư, dùng amount thực tế
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

  // Trần stack chung (MAX_STACK_AMOUNT = 1000) KHÔNG phù hợp Linh Thạch
  // — chi phí Đột Phá lên tới hàng tỷ. undefined với material khác =
  // trần chung.
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

/** Mỗi 30 cấp Cường Hóa chuyển sang một phẩm Linh Thạch cao hơn. */
export function getSpiritStoneMaterialIdForEnhanceLevel(level: number): string {
  if (level >= 60) return SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID
  if (level >= 30) return SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID
  return SPIRIT_STONE_MATERIAL_ID
}

// =========================
// Quy đổi phẩm (review 2026-08-28, economy-ecosystem-plan T2): CHỈ có
// quy đổi 1 CHIỀU LÊN — 100 Hạ → 1 Trung, 100 Trung → 1 Thượng. Không
// có chiều ngược để giữ sink (Linh Thạch thượng phẩm không bị tháo ra
// lại thành 100 hạ phẩm bypass chi phí).
// gp123 6G (2026-09-06):getNextSpiritStoneMaterialId đã bị XÓA cùng API
// quy đổi (GameManager.convertSpiritStonesUp/convertMaterialTier) —
// thu mua theo gate phẩm thay thế. SPIRIT_STONE_CONVERSION_RATIO giữ
// lại: TuLinhTranBalance vẫn dùng làm hệ số quy đổi giá (xem
// core/economy/TuLinhTranBalance.ts).
// =========================

export const SPIRIT_STONE_CONVERSION_RATIO = 100
