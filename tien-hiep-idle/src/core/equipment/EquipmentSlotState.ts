import type { EquipmentSlot } from './EquipmentTypes'
import type { SocketedFormation } from './EquipmentInstance'

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

  socketedFormation?: SocketedFormation

  // Tổng số slot Affix đã mở qua Yểm Phù, tích luỹ theo SLOT (không
  // theo item) — item đang trang bị trong slot này phải có đủ affix
  // khớp hạn mức, xem EquipmentSystem.reconcileBonusAffixSlots().
  bonusAffixSlots: number

  // Home Hub Phase 2 — danh sách id các Phù Chú ĐÃ áp vào slot này
  // (tích luỹ theo SLOT, giống bonusAffixSlots — Phù Chú chỉ CỘNG,
  // không có cơ chế gỡ, xem TalismanSystem.applyToEquipment()). Dùng
  // để hiện badge trên EquipmentPaperdoll.vue, đối xứng
  // socketedFormation.
  appliedTalismanIds: string[]
}

export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'helmet', 'armor', 'boots', 'ring', 'necklace']

export function createDefaultSlotState(slot: EquipmentSlot): EquipmentSlotState {
  return {
    slot,

    enhanceLevel: 0,

    socketedFormation: undefined,

    bonusAffixSlots: 0,

    appliedTalismanIds: [],
  }
}
