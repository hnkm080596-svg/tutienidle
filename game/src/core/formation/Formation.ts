import type { EquipmentSlot } from '../equipment/EquipmentTypes'
import type { TwoModifiers } from '../equipment/SocketedModifierItem'
import type { ProfessionGrade } from '../profession/ProfessionGrade'

/**
 * Trận (2026-08-24, resource-professions-rework §7) — modifier-item gắn
 * TRÊN EQUIPMENT SLOT (mỗi slot tối đa 1 Trận), cấp ĐÚNG HAI modifier
 * tĩnh thiên tấn công/ngũ hành. MVP BỎ trigger/stack khỏi Trận — nếu
 * sau này cần trigger, đó là archetype riêng đi qua modifier runtime
 * authority, không nhét vào schema socket tĩnh.
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
