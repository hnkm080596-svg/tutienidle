import type { EquipmentSlot } from './EquipmentTypes'
import type { EquipmentSlotState } from './EquipmentSlotState'
import { EQUIPMENT_SLOTS, createDefaultSlotState } from './EquipmentSlotState'

/**
 * Sống ở cấp GameManager (KHÔNG thuộc EquipmentBag) — 6 slot cố định
 * khởi tạo sẵn từ đầu, tồn tại suốt đời nhân vật, độc lập với việc
 * slot đó có đang trang bị gì hay không (xem EquipmentSlotState.ts).
 */
export class EquipmentSlotManager {
  private readonly slots = new Map<EquipmentSlot, EquipmentSlotState>()

  constructor() {
    for (const slot of EQUIPMENT_SLOTS) {
      this.slots.set(slot, createDefaultSlotState(slot))
    }
  }

  get(slot: EquipmentSlot): EquipmentSlotState {
    return this.slots.get(slot)!
  }

  getAll(): EquipmentSlotState[] {
    return Array.from(this.slots.values())
  }

  /**
   * Nạp lại từ save — chỉ ghi đè slot có trong save, slot thiếu (save
   * cũ hơn hoặc lỗi data) giữ nguyên default đã khởi tạo ở constructor.
   */
  restore(entries: EquipmentSlotState[]) {
    for (const entry of entries) {
      this.slots.set(entry.slot, entry)
    }
  }
}
