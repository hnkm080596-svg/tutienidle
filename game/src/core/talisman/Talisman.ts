import type { EquipmentSlot } from '../equipment/EquipmentTypes'
import type { TwoModifiers } from '../equipment/SocketedModifierItem'
import type { ProfessionGrade } from '../profession/ProfessionGrade'

/**
 * Phù (2026-08-24, resource-professions-rework §7) — modifier-item gắn
 * TRÊN EQUIPMENT SLOT (mỗi slot tối đa 1 Phù), cấp ĐÚNG HAI modifier
 * tĩnh thiên phòng thủ/tiện ích/tài nguyên. KHÔNG còn mở bonusAffixSlots
 * (hệ Affix trở lại thuộc Luyện Khí). Socket mọi slot qua `allowedSlots`
 * data; chỉ socket cùng cảnh giới với equipment đang gắn.
 */
export interface Talisman {
  id: string

  name: string

  description?: string

  icon?: string

  /** Cảnh giới của Phù — socket chỉ khớp equipment cùng realmId. */
  realmId: string

  /** Phẩm nghề theo cảnh giới (ProfessionGrade, KHÁC ItemGrade trang bị). */
  grade: ProfessionGrade

  allowedSlots: readonly EquipmentSlot[]

  modifiers: TwoModifiers
}
