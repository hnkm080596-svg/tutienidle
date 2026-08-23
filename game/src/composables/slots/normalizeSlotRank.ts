// Slot Revamp (tooltip-revamp-plan.md mục 17.5) — SlotView không được
// biết ID domain (vd 'pham_khi', 'tien_pham'); mọi consumer tự chuẩn
// hoá về rank 1-9 qua các hàm này TRƯỚC khi truyền prop qualityRank/
// rarityRank. Cùng thang --rank-color-1..9 (assets/theme.css, mục 16).
import { EQUIPMENT_QUALITY_ORDER, type EquipmentQuality } from '@/core/equipment/EquipmentQuality'
import { PHAM_ORDER, type Pham } from '@/core/item/Pham'

// 9 bậc Quality ánh xạ 1:1 vào rank 1-9.
export function qualityRank(quality: EquipmentQuality): number {
  return EQUIPMENT_QUALITY_ORDER.indexOf(quality) + 1
}

// 5 bậc Phẩm ánh xạ đều vào 1-3-5-7-9 (mục 16).
export function phamRank(pham: Pham): number {
  return PHAM_ORDER.indexOf(pham) * 2 + 1
}

// Cho nơi chỉ có sẵn NameSegment.tone (string, không rõ Equipment hay
// Pill/Talisman/Formation) — thử cả 2 thang thay vì hardcode literal
// bậc cao nhất của từng thang (vd ToastContainer.vue).
export function isMaxRankTone(tone?: string): boolean {
  if (!tone) return false

  if ((EQUIPMENT_QUALITY_ORDER as readonly string[]).includes(tone)) {
    return qualityRank(tone as EquipmentQuality) === 9
  }

  if ((PHAM_ORDER as readonly string[]).includes(tone)) {
    return phamRank(tone as Pham) === 9
  }

  return false
}
