import type { NameSegment } from './NameSegment'

// Terminology align (2026-09-02, user schema chot): thang 5 bac nay la
// truc CHAT (chat luong) cho Dan duoc - nhan hien thi "Hoang Chat->Tien
// Chat" khop ITEM_QUALITY_LABELS cua trang bi. Truc "Pham" (Canh gioi
// tuong quan, 10 bac) nam o ProfessionGrade; Dan co professionGrade
// rieng (Pill.professionGrade, UI uu tien hien thi). Ten type/field/
// values GIU NGUYEN (khong vo save/loot/data), chi doi label text.
// N5 (naming-conventions): display string doi vi user chot terminology,
// khong phai rename co hoc.
export type ItemGrade = 'hoang' | 'huyen' | 'dia' | 'thien' | 'tien'

export const ITEM_GRADE_ORDER: ItemGrade[] = ['hoang', 'huyen', 'dia', 'thien', 'tien']

export const ITEM_GRADE_LABELS: Record<ItemGrade, string> = {
  hoang: 'Hoàng Chất',
  huyen: 'Huyền Chất',
  dia: 'Địa Chất',
  thien: 'Thiên Chất',
  tien: 'Tiên Chất',
}

// Short tier word for the "Chat - Name" name prefix (same ruling as
// ItemQuality.ITEM_QUALITY_SHORT_LABELS - the two axes intentionally
// keep parallel label tables, see the header comment above).
export const ITEM_GRADE_SHORT_LABELS: Record<ItemGrade, string> = {
  hoang: 'Hoàng',
  huyen: 'Huyền',
  dia: 'Địa',
  thien: 'Thiên',
  tien: 'Tiên',
}

// Name composition (2026-09-14 ruling): "{Chat} - {Name}". Structure
// only - the display color lives on the tooltip/toast payload
// (nameColorVar), not per segment (item-info-card spec).
export function composeItemGradeNameSegments(name: string, grade: ItemGrade): NameSegment[] {
  return [
    { text: ITEM_GRADE_SHORT_LABELS[grade] },
    { text: `- ${name}` },
  ]
}
