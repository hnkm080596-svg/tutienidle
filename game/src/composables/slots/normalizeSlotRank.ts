// Slot Revamp (tooltip-revamp-plan.md mục 17.5) — SlotView không được
// biết ID domain (vd 'pham_khi', 'tien'); mọi consumer tự chuẩn hoá về
// rank 1-9 qua các hàm này TRƯỚC khi truyền prop qualityRank/rarityRank.
// Cùng thang --rank-color-1..9 (assets/theme.css).
import { EQUIPMENT_QUALITY_ORDER, type EquipmentQuality } from '@/core/equipment/EquipmentQuality'
import { ITEM_GRADE_ORDER, type ItemGrade } from '@/core/item/ItemGrade'

// 9 bậc Quality ánh xạ 1:1 vào rank 1-9.
export function equipmentQualityRank(quality: EquipmentQuality): number {
  return EQUIPMENT_QUALITY_ORDER.indexOf(quality) + 1
}

// 5 bậc Grade ánh xạ đều vào 1-3-5-7-9.
export function itemGradeRank(grade: ItemGrade): number {
  return ITEM_GRADE_ORDER.indexOf(grade) * 2 + 1
}

// Cho nơi chỉ có sẵn NameSegment.tone (string, không rõ nguồn) — thử cả
// 2 thang thay vì hardcode literal bậc cao nhất của từng thang.
export function isMaxRankTone(tone?: string): boolean {
  if (!tone) return false

  if ((EQUIPMENT_QUALITY_ORDER as readonly string[]).includes(tone)) {
    return equipmentQualityRank(tone as EquipmentQuality) === 9
  }

  if ((ITEM_GRADE_ORDER as readonly string[]).includes(tone)) {
    return itemGradeRank(tone as ItemGrade) === 9
  }

  return false
}
