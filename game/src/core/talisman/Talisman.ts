import type { ItemGrade } from '../item/ItemGrade'

/**
 * Phù chú — KHÔNG dùng trong combat. Là catalyst tiêu hao khi áp
 * dụng lên 1 EquipmentInstance, mở thêm slot chỉ số phụ rồi roll
 * ngay substat mới lấp vào (xem TalismanSystem.applyToEquipment()).
 */
export interface Talisman {
  id: string

  name: string

  description?: string

  // Path ảnh minh hoạ — khai NGAY TRÊN data item (2026-08-15), xem
  // ghi chú tương tự trong core/technique/Technique.ts.
  icon?: string

  // Naming-principles pass (2026-08-14) — thay `grade: number` cũ,
  // xem Pill.ts's ghi chú tương tự.
  grade: ItemGrade

  // 0~2 — số slot chỉ số phụ mở thêm mỗi lần áp dụng.
  extraSubstatSlots: number
}
