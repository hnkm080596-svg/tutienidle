import type { EquipmentSlot } from '../equipment/EquipmentTypes'
import type { TwoModifiers } from '../equipment/SocketedModifierItem'
import type { ProfessionGrade } from '../profession/ProfessionGrade'

/**
 * Phu (2026-08-24, resource-professions-rework sec7) - modifier-item gan
 * TREN EQUIPMENT SLOT (moi slot toi da 1 Phu), cap DUNG HAI modifier
 * tinh thien phong thu/tien ich/tai nguyen. KHONG con mo bonusAffixSlots
 * (he Affix tro lai thuoc Luyen Khi). Socket moi slot qua `allowedSlots`
 * data; chi socket cung canh gioi voi equipment dang gan.
 */
export interface Talisman {
  id: string

  name: string

  description?: string

  icon?: string

  /** Canh gioi cua Phu - socket chi khop equipment cung realmId. */
  realmId: string

  /** Pham nghe theo canh gioi (ProfessionGrade, KHAC ItemGrade trang bi). */
  grade: ProfessionGrade

  allowedSlots: readonly EquipmentSlot[]

  modifiers: TwoModifiers
}
