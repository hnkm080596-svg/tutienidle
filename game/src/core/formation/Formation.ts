import type { EquipmentSlot } from '../equipment/EquipmentTypes'
import type { TwoModifiers } from '../equipment/SocketedModifierItem'
import type { ProfessionGrade } from '../profession/ProfessionGrade'

/**
 * Tran (2026-08-24, resource-professions-rework sec7) - modifier-item gan
 * TREN EQUIPMENT SLOT (moi slot toi da 1 Tran), cap DUNG HAI modifier
 * tinh thien tan cong/ngu hanh. MVP BO trigger/stack khoi Tran - neu
 * sau nay can trigger, do la archetype rieng di qua modifier runtime
 * authority, khong nhet vao schema socket tinh.
 */
export interface Formation {
  id: string

  name: string

  description?: string

  icon?: string

  realmId: string

  grade: ProfessionGrade

  allowedSlots: readonly EquipmentSlot[]

  modifiers: TwoModifiers
}
