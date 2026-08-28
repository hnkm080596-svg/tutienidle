// RefinementBalance (2026-08-25, resource-professions-rework plan §7.2/
// §7.3/§7.4) — toàn bộ balance của Khí Đường mới nằm tại ĐÂY (balance
// data, chưa phải số cuối — playtest chỉnh tại đây). Nguồn nhận/cap/hồi
// Điểm Rèn được chốt baseline: hồi 1 điểm / 5 phút thời gian thực, cap
// 120; KHÔNG hard-code nguồn từ combat drop (§13.5).
import type { OreQuality } from '../production/ProductionTypes'

// =========================
// Điểm Rèn — PER-ITEM (rework 2026-08-26 theo yêu cầu: "điểm rèn là một
// asset của equipment chứ không phải điểm trong Khí Đường")
// =========================
// MỖI món trang bị mang ĐIỂM RÈN RIÊNG (EquipmentInstance.refinementPoints,
// khởi tạo full-cap lúc rớt/tạo đồ). Tẩy Luyện/Tinh Luyện tiêu vào ĐÚNG
// món đó; cạn điểm = món không phát triển được nữa. KHÔNG còn pool chung
// người chơi, KHÔNG còn hồi theo thời gian thực.

export const REFINEMENT_POINTS_CAP = 120

/** Cost Điểm Rèn — Tẩy Luyện mỗi lần reroll toàn bộ. */
export const WASH_REFINEMENT_COST = 20

/** Cost Điểm Rèn — Tinh Luyện (phẳng, không theo số dòng khóa). */
export const REFINE_REFINEMENT_COST = 10

// =========================
// Tẩy Luyện (§7.3): phẩm Quáng quyết định HAI bảng weighted roll —
// số dòng substat và tier ban đầu từng dòng. Phẩm cao thiên về nhiều
// dòng/tier cao nhưng không bảo đảm kết quả.
// =========================

/** Trọng số roll SỐ DÒNG affix (index 0 → 1 dòng ... index 3 → 4 dòng). */
export const WASH_LINE_COUNT_WEIGHTS: Record<OreQuality, readonly number[]> = {
  hoang: [55, 30, 10, 5],
  huyen: [35, 35, 20, 10],
  dia: [20, 30, 30, 20],
  thien: [10, 25, 35, 30],
  tien: [5, 15, 30, 50],
}

/** Trọng weight roll TIER BAN ĐẦU của từng dòng (index 0 → tier 1 ...). */
export const WASH_TIER_WEIGHTS: Record<OreQuality, readonly number[]> = {
  hoang: [70, 25, 5],
  huyen: [50, 35, 15],
  dia: [35, 35, 30],
  thien: [20, 40, 40],
  tien: [10, 35, 55],
}

/** Số Quáng tiêu thụ mỗi lần Tẩy Luyện. */
export const WASH_ORE_AMOUNT = 3

/** Linh Thạch mỗi lần Tẩy Luyện. */
export const WASH_SPIRIT_STONE_COST = 100

// =========================
// Tinh Luyện (§7.4): giữ identity, roll lại giá trị trong ±20% giá trị
// hiện tại (clamp range tier). Khóa N dòng → Tinh Hoa/Linh Thạch hệ số
// N + L; KHÔNG cho khóa toàn bộ.
// =========================

export const REFINE_VALUE_VARIANCE = 0.2

export const REFINE_MAX_LOCKS = 3

/** Linh Thạch đơn giá mỗi đơn vị (N + L) của Tinh Luyện. */
export const REFINE_SPIRIT_STONE_PER_UNIT = 50

// =========================
// Hóa Luyện (§7.5): số Tinh Hoa theo quality trang bị — mapping realm
// trang bị → tier Tinh Hoa (chốt §13.6, data material tương ứng nằm ở
// data/materials generator). ĐỦ 9 realm + body_integration (Hợp Thể
// dùng chung tier kinh tế với Đại Thừa — RealmTierMap.ts). Id realm 4+
// đặt theo bậc quality trang bị tương ứng (EquipmentQuality.ts) để
// thống nhất với truc-co-kim-dan-content-plan (review 2026-08-28,
// economy-ecosystem-plan T1).
// =========================

export const EQUIPMENT_REALM_ESSENCE_MATERIAL: Record<string, string> = {
  mortal: 'tinh_hoa_pham_khi',
  qi_refining: 'tinh_hoa_bao_khi',
  foundation_establishment: 'tinh_hoa_linh_khi',
  golden_core: 'tinh_hoa_phap_khi',
  nascent_soul: 'tinh_hoa_phap_bao',
  soul_transformation: 'tinh_hoa_tien_bao',
  void_refinement: 'tinh_hoa_chi_bao',
  mahayana: 'tinh_hoa_hon_don_chi_bao',
  body_integration: 'tinh_hoa_hon_don_chi_bao',
  tribulation: 'tinh_hoa_thien_dia_trong_khi',
}

/**
 * Resolve id Tinh Hoa theo realm trang bị. Trả `undefined` khi realm chưa
 * map — caller PHẢI guard và từ chối thao tác (review 2026-08-28: fallback
 * im lặng về pham_khi khiến trang bị realm cao bị phân giải ra Tinh Hoa
 * realm 1, mất giá trị mà không ai biết).
 */
export function equipmentEssenceMaterialId(realmId: string): string | undefined {
  return EQUIPMENT_REALM_ESSENCE_MATERIAL[realmId]
}

export const DISSOLVE_ESSENCE_RANGE_BY_QUALITY: Record<string, { min: number; max: number }> = {
  hoang: { min: 1, max: 3 },
  huyen: { min: 2, max: 4 },
  dia: { min: 3, max: 5 },
  thien: { min: 4, max: 6 },
  tien: { min: 5, max: 7 },
}
