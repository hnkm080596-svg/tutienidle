import type { NameSegment } from './NameSegment'

// Terminology align (2026-09-02, user schema chốt): thang 5 bậc này là
// trục CHẤT (chất lượng) cho Đan dược — nhãn hiển thị "Hoàng Chất→Tiên
// Chất" khớp ITEM_QUALITY_LABELS của trang bị. Trục "Phẩm" (Cảnh giới
// tương quan, 10 bậc) nằm ở ProfessionGrade; Đan có professionGrade
// riêng (Pill.professionGrade, UI ưu tiên hiển thị). Tên type/field/
// values GIỮ NGUYÊN (không vỡ save/loot/data), chỉ đổi label text.
// N5 (naming-conventions): display string đổi vì user chốt terminology,
// không phải rename cơ học.
export type ItemGrade = 'hoang' | 'huyen' | 'dia' | 'thien' | 'tien'

export const ITEM_GRADE_ORDER: ItemGrade[] = ['hoang', 'huyen', 'dia', 'thien', 'tien']

export const ITEM_GRADE_LABELS: Record<ItemGrade, string> = {
  hoang: 'Hoàng Chất',
  huyen: 'Huyền Chất',
  dia: 'Địa Chất',
  thien: 'Thiên Chất',
  tien: 'Tiên Chất',
}

export function composeItemGradeNameSegments(name: string, grade: ItemGrade): NameSegment[] {
  return [
    { text: ITEM_GRADE_LABELS[grade], colorVar: `--grade-${grade}`, tone: grade },
    { text: name },
  ]
}
