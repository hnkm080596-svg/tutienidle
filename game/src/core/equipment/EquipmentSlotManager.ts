import type { EquipmentSlot } from './EquipmentTypes'
import type { EquipmentSlotState } from './EquipmentSlotState'
import { EQUIPMENT_SLOTS, createDefaultSlotState } from './EquipmentSlotState'

/**
 * Song o cap GameManager (KHONG thuoc EquipmentBag) - 6 slot co dinh
 * khoi tao san tu dau, ton tai suot doi nhan vat, doc lap voi viec
 * slot do co dang trang bi gi hay khong (xem EquipmentSlotState.ts).
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
   * Nap lai tu save.
   *
   * M1 (ARCH-001) - the payload replaces the WHOLE fixed 6-slot set:
   * a slot absent from the payload resets to its default instead of
   * keeping stale live progress (a partial merge leaked enhance levels
   * across restores), and every stored entry is a detached copy so the
   * payload stays a value (mutating it later cannot reach live state).
   */
  restore(entries: EquipmentSlotState[]) {
    for (const slot of EQUIPMENT_SLOTS) {
      this.slots.set(slot, createDefaultSlotState(slot))
    }

    for (const entry of entries) {
      // 9.10 defense-in-depth (validator v55 la gate chinh) - entry voi
      // slot id la (save cu/loi data) bi bo qua, khong them slot moi vao
      // map co dinh 6 slot.
      if (!EQUIPMENT_SLOTS.includes(entry.slot)) continue

      this.slots.set(entry.slot, structuredClone(entry))
    }
  }
}
