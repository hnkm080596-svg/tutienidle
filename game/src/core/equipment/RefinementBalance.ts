// RefinementBalance (2026-08-25, resource-professions-rework plan §7.2/
// §7.3/§7.4) — toàn bộ balance của Khí Đường mới nằm tại ĐÂY (balance
// data, chưa phải số cuối — playtest chỉnh tại đây).
// Rework 2026-08-30: Điểm Rèn KHÔNG còn random lúc sinh (bỏ
// forgePotential roll) — mỗi item có đúng trần theo quality của nó;
// cost Tẩy/Tinh Luyện leo thang theo quality thay vì phẳng.
import type { ItemQuality } from '../item/ItemQuality'

// =========================
// Điểm Rèn — PER-ITEM (rework 2026-08-26: điểm rèn là asset của
// equipment; rework 2026-08-30: xác định bằng PHẨM, không random)
// =========================
// MỖI món trang bị mang ĐIỂM RÈN RIÊNG (EquipmentInstance.forgePoints,
// khởi tạo full-cap lúc rớt/tạo đồ). Tẩy Luyện/Tinh Luyện tiêu vào ĐÚNG
// món đó; cạn điểm = món không phát triển được nữa. KHÔNG còn pool chung
// người chơi, KHÔNG còn hồi theo thời gian thực.

/** Luyện Khí Tinh Hoa tiêu hao khi Tẩy Luyện theo Chất. */
export const WASH_TINH_HOA_COST_BY_QUALITY: Record<ItemQuality, number> = {
  hoang: 2,
  huyen: 5,
  dia: 9,
  thien: 13,
  tien: 18,
}

/** Luyện Khí Tinh Hoa tiêu hao khi Tinh Luyện theo Chất. */
export const REFINE_TINH_HOA_COST_BY_QUALITY: Record<ItemQuality, number> = {
  hoang: 1,
  huyen: 3,
  dia: 5,
  thien: 7,
  tien: 9,
}

// =========================
// Tẩy Luyện: Chất của item quyết định trần dòng và trọng số tier.
// =========================

/** Trọng weight roll TIER BAN ĐẦU của từng dòng (index 0 → tier 1 ...). */
export const WASH_TIER_WEIGHTS_BY_QUALITY: Record<ItemQuality, readonly number[]> = {
  hoang: [70, 25, 5],
  huyen: [50, 35, 15],
  dia: [35, 35, 30],
  thien: [20, 40, 40],
  tien: [10, 35, 55],
}

/** Linh Thạch mỗi lần Tẩy Luyện. */
export const WASH_SPIRIT_STONE_COST = 100

// =========================
// Tinh Luyện (§7.4): giữ identity, mỗi dòng eligible chỉ tăng 5–20%
// giá trị hiện tại rồi clamp theo range tier. Khóa L dòng chỉ
// làm tăng chi phí Linh Thạch theo N + L; KHÔNG cho khóa toàn bộ.
// =========================

export const REFINE_INCREASE_MIN = 0.05

export const REFINE_INCREASE_MAX = 0.2

export const REFINE_MAX_LOCKS = 3

/** Linh Thạch đơn giá mỗi đơn vị (N + L) của Tinh Luyện. */
export const REFINE_SPIRIT_STONE_PER_UNIT = 50
