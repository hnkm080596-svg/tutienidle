import type { EquipmentSlot } from './EquipmentTypes'

/**
 * MASTER SPEC Mục XVI ("Item và Slot phải tách hoàn toàn") — Cường
 * Hóa + Khắc Trận (Formation) + Yểm Phù (bonus affix slots) giờ
 * gắn theo SLOT của nhân vật, KHÔNG còn theo từng EquipmentInstance —
 * đổi trang bị trong slot đó KHÔNG mất enhanceLevel/Formation/bonus
 * slots đã đầu tư (chỉ 6 slot cố định, sống suốt đời nhân vật, không
 * bị xoá khi tháo/đổi đồ). EquipmentInstance chỉ còn giữ
 * refineLevel/affixes/quality/rarity — những thứ THẬT SỰ gắn liền
 * với 1 món đồ cụ thể (Tẩy Luyện/Tinh Luyện/Nâng Phẩm vẫn item-level).
 */
export interface EquipmentSlotState {
  slot: EquipmentSlot

  enhanceLevel: number

  // Task 10 (rework P3, 2026-09-01) — pity counter cường hóa: đếm lần
  // THẤT BẠI liên tiếp; đạt ENHANCE_PITY_THRESHOLD (10) → lần kế chắc
  // chắn thành công, reset khi thành công. Persist qua save slot
  // entries (saveShapeValidation Task 7 đã nhận enhanceFailStreak).
  enhanceFailStreak: number

}

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'weapon',
  'helmet',
  'armor',
  'boots',
  'ring',
  'necklace',
]

export function createDefaultSlotState(slot: EquipmentSlot): EquipmentSlotState {
  return {
    slot,

    enhanceLevel: 0,

    enhanceFailStreak: 0,
  }
}
