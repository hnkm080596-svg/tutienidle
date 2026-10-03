// RefinementBalance (2026-08-25, resource-professions-rework plan sec7.2/
// sec7.3/sec7.4) - toan bo balance cua Khi Duong moi nam tai DAY (balance
// data, chua phai so cuoi - playtest chinh tai day).
// Rework 2026-08-30: Diem Ren KHONG con random luc sinh (bo
// forgePotential roll) - moi item co dung tran theo quality cua no;
// cost Tay/Tinh Luyen leo thang theo quality thay vi phang.
import type { ItemQuality } from '../item/ItemQuality'

// =========================
// Diem Ren - PER-ITEM (rework 2026-08-26: diem ren la asset cua
// equipment; rework 2026-08-30: xac dinh bang PHAM, khong random)
// =========================
// MOI mon trang bi mang DIEM REN RIENG (EquipmentInstance.forgePoints,
// khoi tao full-cap luc rot/tao do). Tay Luyen/Tinh Luyen tieu vao DUNG
// mon do; can diem = mon khong phat trien duoc nua. KHONG con pool chung
// nguoi choi, KHONG con hoi theo thoi gian thuc.

/** Luyen Khi Tinh Hoa tieu hao khi Tay Luyen theo Chat. */
export const WASH_TINH_HOA_COST_BY_QUALITY: Record<ItemQuality, number> = {
  hoang: 2,
  huyen: 5,
  dia: 9,
  thien: 13,
  tien: 18,
}

/** Luyen Khi Tinh Hoa tieu hao khi Tinh Luyen theo Chat. */
export const REFINE_TINH_HOA_COST_BY_QUALITY: Record<ItemQuality, number> = {
  hoang: 1,
  huyen: 3,
  dia: 5,
  thien: 7,
  tien: 9,
}

// =========================
// Tay Luyen: Chat cua item quyet dinh tran dong va trong so tier.
// =========================

/** Trong weight roll TIER BAN DAU cua tung dong (index 0 -> tier 1 ...). */
export const WASH_TIER_WEIGHTS_BY_QUALITY: Record<ItemQuality, readonly number[]> = {
  hoang: [70, 25, 5],
  huyen: [50, 35, 15],
  dia: [35, 35, 30],
  thien: [20, 40, 40],
  tien: [10, 35, 55],
}

/** Linh Thach moi lan Tay Luyen. */
export const WASH_SPIRIT_STONE_COST = 100

// =========================
// Tinh Luyen (sec7.4): giu identity, moi dong eligible chi tang 5-20%
// gia tri hien tai roi clamp theo range tier. Khoa L dong chi
// lam tang chi phi Linh Thach theo N + L; KHONG cho khoa toan bo.
// =========================

export const REFINE_INCREASE_MIN = 0.05

export const REFINE_INCREASE_MAX = 0.2

export const REFINE_MAX_LOCKS = 3

/** Linh Thach don gia moi don vi (N + L) cua Tinh Luyen. */
export const REFINE_SPIRIT_STONE_PER_UNIT = 50
