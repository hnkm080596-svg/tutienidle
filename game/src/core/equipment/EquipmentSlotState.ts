import type { EquipmentSlot } from './EquipmentTypes'
import type { SocketedModifierItem } from './SocketedModifierItem'

/**
 * MASTER SPEC Mục XVI ("Item và Slot phải tách hoàn toàn") — Cường
 * Hóa + Khắc Trận (Formation) + Yểm Phù (bonus affix slots) giờ
 * gắn theo SLOT của nhân vật, KHÔNG còn theo từng EquipmentInstance —
 * đổi trang bị trong slot đó KHÔNG mất enhanceLevel/Formation/bonus
 * slots đã đầu tư (chỉ 6 slot cố định, sống suốt đời nhân vật, không
 * bị xoá khi tháo/đổi đồ). EquipmentInstance chỉ còn giữ
 * refineLevel/affixes/quality/rarity — những thứ THẬT SỰ gắn liền
 * với 1 món đồ cụ thể (Tẩy Luyện/Tinh Luyện/Nâng Phẩm vẫn item-level).
 *
 * Core Loop Foundation checklist (Phase 3, Mục AFFIX) — đổi tên
 * bonusSubstatSlots -> bonusAffixSlots (cùng ý nghĩa, khớp thuật ngữ
 * Affix thay cho substat cũ).
 */
export interface EquipmentSlotState {
  slot: EquipmentSlot

  enhanceLevel: number

  // Phù/Trận socket (2026-08-24, resource-professions-rework §7.2) —
  // MỖI slot tối đa 1 Phù + 1 Trận, mỗi item ĐÚNG HAI modifier; chỉ
  // active khi slot đang có equipment. Legacy socketedFormation
  // (trigger/stack) + appliedTalismanIds được migration v43 hoàn trả
  // bag rồi xoá.
  socketedTalisman?: SocketedModifierItem

  socketedFormation?: SocketedModifierItem

  // LEGACY (migration v43) — tổng slot Affix mở qua Yểm Phù cũ. Sau
  // migration luôn 0 (Phù không còn mở affix, hệ Affix thuộc Luyện Khí).
  bonusAffixSlots: number

  // LEGACY (migration v43) — id Phù đã apply theo cơ chế cũ; migration
  // hoàn trả bag rồi xoá mảng.
  appliedTalismanIds: string[]
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

    socketedFormation: undefined,

    bonusAffixSlots: 0,

    appliedTalismanIds: [],
  }
}
