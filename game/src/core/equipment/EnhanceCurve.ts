// Task 10 (rework P3, 2026-09-01) — đường cong cường hóa SLOT (spec
// item-grade-quality-model §5.1, user-approved): mũ 0.956 + pity 10 +
// max 100 level (10 cảnh giới × 10 cấp). Thuần hàm — dùng chung cho
// EquipmentSystem roll và UI preview hiển thị tỉ lệ.

/** Mỗi level giảm ~4.4% tỉ lệ (×0.956) — extremum có chủ ý, floor 1%. */
const ENHANCE_RATE_BASE = 100

const ENHANCE_RATE_DECAY = 0.956

const ENHANCE_RATE_FLOOR = 1

/**
 * Tỉ lệ thành công (%) của lần cường hóa LÚC SLOT đang ở `level - 1`
 * (đang lên level `level`). L1 = 100%; L10 ≈ 64%; L40 ≈ 17%; L100 = 1%
 * (floor). Level < 1 coi như L1. Kết quả nguyên trong [1, 100].
 */
export function enhanceSuccessRate(level: number): number {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1

  return Math.max(
    ENHANCE_RATE_FLOOR,
    Math.round(ENHANCE_RATE_BASE * ENHANCE_RATE_DECAY ** (safeLevel - 1)),
  )
}

/** Pity: 10 lần THẤT BẠI liên tiếp → lần kế chắc chắn thành công. */
export const ENHANCE_PITY_THRESHOLD = 10

/** 10 cảnh giới × 10 cấp cường hóa = 100 level slot. */
export const MAX_SLOT_ENHANCE_LEVEL = 100

/**
 * Hệ số scale slot: `1 + enhanceLevel × 0.06`. Tổng công bằng giữ
 * nguyên tinh thần cũ (0.08 × 10 cấp = 0.8 max) mở ra trần 100:
 * 0.06 × 100 = 6.0 — trend tăng lực theo slot tiếp tục qua realm.
 */
export const ENHANCE_SLOT_SCALE = 0.06
