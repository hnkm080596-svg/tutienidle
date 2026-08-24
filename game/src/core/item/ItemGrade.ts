import type { NameSegment } from './NameSegment'

// Milestone naming v41 — thang 5 phẩm chung cho Đan/Phù/Trận và trục
// rarity của trang bị (field EquipmentInstance.rarity). Trước đây tên
// `Pham` + values hậu tố `_pham` gây xoắn với EquipmentQuality (9 bậc
// "khí") — xem docs/naming-conventions.md mục "Hai trục phẩm chất".
export type ItemGrade = 'hoang' | 'huyen' | 'dia' | 'thien' | 'tien'

export const ITEM_GRADE_ORDER: ItemGrade[] = ['hoang', 'huyen', 'dia', 'thien', 'tien']

export const ITEM_GRADE_LABELS: Record<ItemGrade, string> = {
  hoang: 'Hoàng Phẩm',
  huyen: 'Huyền Phẩm',
  dia: 'Địa Phẩm',
  thien: 'Thiên Phẩm',
  tien: 'Tiên Phẩm',
}

export function composeItemGradeNameSegments(name: string, grade: ItemGrade): NameSegment[] {
  return [
    { text: ITEM_GRADE_LABELS[grade], colorVar: `--grade-${grade}`, tone: grade },
    { text: name },
  ]
}
