import type { EquipmentSlot } from './EquipmentTypes'

/**
 * MASTER SPEC Muc XVI ("Item va Slot phai tach hoan toan") - Cuong
 * Hoa + Khac Tran (Formation) + Yem Phu (bonus affix slots) gio
 * gan theo SLOT cua nhan vat, KHONG con theo tung EquipmentInstance -
 * doi trang bi trong slot do KHONG mat enhanceLevel/Formation/bonus
 * slots da dau tu (chi 6 slot co dinh, song suot doi nhan vat, khong
 * bi xoa khi thao/doi do). EquipmentInstance chi con giu
 * refineLevel/affixes/quality/rarity - nhung thu THAT SU gan lien
 * voi 1 mon do cu the (Tay Luyen/Tinh Luyen/Nang Pham van item-level).
 */
export interface EquipmentSlotState {
  slot: EquipmentSlot

  enhanceLevel: number

  // Task 10 (rework P3, 2026-09-01) - pity counter cuong hoa: dem lan
  // THAT BAI lien tiep; dat ENHANCE_PITY_THRESHOLD (10) -> lan ke chac
  // chan thanh cong, reset khi thanh cong. Persist qua save slot
  // entries (saveShapeValidation Task 7 da nhan enhanceFailStreak).
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
