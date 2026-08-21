import type { Talisman } from './Talisman'
import type { EquipmentBag } from '../equipment/EquipmentBag'
import type { EquipmentRegistry } from '../equipment/EquipmentRegistry'
import type { EquipmentSlotManager } from '../equipment/EquipmentSlotManager'
import type { AffixRegistry } from '../equipment/AffixRegistry'
import { EquipmentSystem } from '../equipment/EquipmentSystem'

export class TalismanSystem {
  constructor(private readonly equipmentSystem: EquipmentSystem) {}

  /**
   * MASTER SPEC Mục XVI (Phase 9) — Yểm Phù giờ áp lên SLOT của item
   * được chọn (không phải chính item đó) — resolve slot từ
   * instanceId (UX vẫn "bấm 1 item trong bag để áp phù"), state thật
   * cộng dồn ở EquipmentSlotManager nên đổi trang bị không mất hạn
   * mức đã mở. Core Loop Foundation checklist (Phase 3) — mở thêm
   * hạn mức AFFIX (không còn substat), xem EquipmentSystem.
   * addBonusAffixSlots().
   */
  applyToEquipment(
    talisman: Talisman,
    instanceId: string,
    equipmentBag: EquipmentBag,
    equipmentRegistry: EquipmentRegistry,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ): boolean {
    const instance = equipmentBag.get(instanceId)

    if (!instance) {
      return false
    }

    return this.equipmentSystem.addBonusAffixSlots(
      instance.slot,
      talisman.extraSubstatSlots,
      slotManager,
      equipmentBag,
      equipmentRegistry,
      affixRegistry,
    )
  }
}
