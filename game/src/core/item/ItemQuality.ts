import type { NameSegment } from './NameSegment'

export type ItemQuality = 'hoang' | 'huyen' | 'dia' | 'thien' | 'tien'

export const ITEM_QUALITY_ORDER: readonly ItemQuality[] = ['hoang', 'huyen', 'dia', 'thien', 'tien']

export const ITEM_QUALITY_LABELS: Record<ItemQuality, string> = {
  hoang: 'Hoàng Chất',
  huyen: 'Huyền Chất',
  dia: 'Địa Chất',
  thien: 'Thiên Chất',
  tien: 'Tiên Chất',
}

// Fix 2 (final review, item-grade-quality-rework) — dùng namespace
// --grade-* (5 vars riêng, rải 1-3-5-7-9 trên thang --rank-color, xem
// assets/theme.css) THAY VÌ --rank-color-${index+1} (1-5) như trước:
// equipment name ghép CHUNG 1 chuỗi cả Phẩm Nghề (ProfessionGrade, 10
// bậc, EquipmentNaming.ts tô --rank-color-1..10) VÀ Chất (ItemQuality,
// 5 bậc, hàm này) — nếu Chất cũng tô --rank-color-1..5 thì bậc 5 (Tiên
// Chất, đỉnh Chất) trùng màu bậc 5/10 (giữa thang Phẩm Nghề), vi phạm
// spec §5.8 "dải màu chất riêng biệt với phẩm — 2 dải không trùng màu
// tránh nhầm". --grade-* vốn đã là dải riêng cho đúng mục đích này
// (ItemGrade.ts's composeItemGradeNameSegments dùng cho Đan/Phù/Trận).
export function composeItemQualityNameSegments(name: string, quality: ItemQuality): NameSegment[] {
  return [
    {
      text: ITEM_QUALITY_LABELS[quality],
      colorVar: `--grade-${quality}`,
      tone: quality,
    },
    { text: name },
  ]
}
