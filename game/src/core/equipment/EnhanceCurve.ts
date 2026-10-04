// Task 10 (rework P3, 2026-09-01) - duong cong cuong hoa SLOT (spec
// item-grade-quality-model sec5.1, user-approved): mu 0.956 + pity 10 +
// max 100 level (10 canh gioi x 10 cap). Thuan ham - dung chung cho
// EquipmentSystem roll va UI preview hien thi ti le.

/** Moi level giam ~4.4% ti le (x0.956) - extremum co chu y, floor 1%. */
const ENHANCE_RATE_BASE = 100

const ENHANCE_RATE_DECAY = 0.956

const ENHANCE_RATE_FLOOR = 1

/**
 * Ti le thanh cong (%) cua lan cuong hoa LUC SLOT dang o `level - 1`
 * (dang len level `level`). L1 = 100%; L10 ~ 64%; L40 ~ 17%; L100 = 1%
 * (floor). Level < 1 coi nhu L1. Ket qua nguyen trong [1, 100].
 */
export function enhanceSuccessRate(level: number): number {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1

  return Math.max(
    ENHANCE_RATE_FLOOR,
    Math.round(ENHANCE_RATE_BASE * ENHANCE_RATE_DECAY ** (safeLevel - 1)),
  )
}

/** Pity: 10 lan THAT BAI lien tiep -> lan ke chac chan thanh cong. */
export const ENHANCE_PITY_THRESHOLD = 10

/** 10 canh gioi x 10 cap cuong hoa = 100 level slot. */
export const MAX_SLOT_ENHANCE_LEVEL = 100

/**
 * He so scale slot: `1 + enhanceLevel x 0.06`. Tong cong bang giu
 * nguyen tinh than cu (0.08 x 10 cap = 0.8 max) mo ra tran 100:
 * 0.06 x 100 = 6.0 - trend tang luc theo slot tiep tuc qua realm.
 */
export const ENHANCE_SLOT_SCALE = 0.06
