// Slot rank normalization helpers (R14.1b move from composables/slots/):
// pure ordering lookups over core-owned orders, consumed by BOTH the core
// naming authority (EquipmentNaming.ts) and presentation (equipment hall
// rows). A6: shared contracts live below their consumers, so these live in
// core/profession next to PROFESSION_GRADE_ORDER / core/item next to
// ITEM_QUALITY_ORDER, not under composables/.
//
// Two separate axes (Rework P6, item-grade-quality-rework Task 20/21):
//   - "Grade" = ProfessionGrade (10 steps, Cuu Pham -> Tien Pham) maps 1:1
//     onto rank 1-10, NO clamping (step 10 has its own
//     --rank-color-10/--rank-gradient-10 in assets/theme.css).
//   - "Quality" = ItemQuality (5 steps, Hoang -> Tien) maps 1:1 onto
//     rank 1-5 on a separate axis (never spread 1-3-5-7-9; see
//     ItemQuality.ITEM_QUALITY_SHORT_LABELS for the name prefix).
// ItemGrade.ts (the old 1-3-5-7-9 axis) stays for Pill/Talisman/Formation
// content and is unrelated to the equipment-only axes here.
import { ITEM_QUALITY_ORDER, type ItemQuality } from '@/core/item/ItemQuality'
import { PROFESSION_GRADE_ORDER, type ProfessionGrade } from '@/core/profession/ProfessionGrade'

// ItemQuality (5 steps) maps 1:1 onto rank 1-5.
export function itemQualityRank(quality: ItemQuality): number {
  return ITEM_QUALITY_ORDER.indexOf(quality) + 1
}

// ProfessionGrade (10 steps) maps 1:1 onto rank 1-10, no clamp to 9
// (step 10 "Tien Pham" keeps its own color/gradient, see theme.css).
export function professionGradeRank(grade: ProfessionGrade): number {
  return PROFESSION_GRADE_ORDER.indexOf(grade) + 1
}

// For consumers that only see a plain grade/quality key string (e.g.
// Tooltip's qualityKey/gradeKey badge checks) and cannot import the
// typed orders: checks the max rank of BOTH axes.
export function isMaxRankTone(tone?: string): boolean {
  if (!tone) return false

  if ((ITEM_QUALITY_ORDER as readonly string[]).includes(tone)) {
    return itemQualityRank(tone as ItemQuality) === ITEM_QUALITY_ORDER.length
  }

  if ((PROFESSION_GRADE_ORDER as readonly string[]).includes(tone)) {
    return professionGradeRank(tone as ProfessionGrade) === PROFESSION_GRADE_ORDER.length
  }

  return false
}
