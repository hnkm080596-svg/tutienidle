import type { EquipmentSlot } from './EquipmentTypes'
import type { ItemQuality } from '../item/ItemQuality'
import type { ProfessionGrade } from '../profession/ProfessionGrade'
import type { RolledAffix } from './RolledAffix'
import type { StatModifier } from '../stats/StatCalculator'
import type { PassiveTrigger } from '../skill/SkillTypes'

export interface SocketedFormation {
  formationId: string

  trigger: PassiveTrigger

  // Bản copy sống của modifier template — stack tích riêng theo SLOT
  // (Phase 9, xem EquipmentSlotState.ts), mất hết khi unsocket (xem
  // FormationSystem.ts). Đổi trang bị trong slot KHÔNG mất stack.
  modifiers: StatModifier[]
}

/**
 * Một bản instance cụ thể mà người chơi sở hữu, tách khỏi Equipment
 * (template tĩnh trong registry). Khác bản thiết kế cũ (tham chiếu
 * thẳng template.modifiers): instance giờ tự mang chỉ số ĐÃ ROLL
 * (mainStat/affixes) — cùng 1 template có thể sinh ra nhiều instance
 * với phẩm cấp/chất lượng/dòng affix hoàn toàn khác nhau.
 *
 * MASTER SPEC Mục XVI (Phase 9) — enhanceLevel/socketedFormation/
 * bonusAffixSlots đã CHUYỂN sang EquipmentSlotState (gắn theo SLOT,
 * không theo instance) — instance giờ chỉ giữ những gì THẬT SỰ gắn
 * liền với 1 món đồ cụ thể: grade/quality/affixes, mainStat và ngân sách
 * forgeUses cho Tẩy Luyện/Tinh Luyện.
 */
export interface EquipmentInstance {
  instanceId: string

  itemId: string

  slot: EquipmentSlot

  equipped: boolean

  grade: ProfessionGrade

  quality: ItemQuality

  // New runtime drops record the level needed to reproduce their exact
  // effective roll range. Debug-created instances may omit it.
  realmLevel?: number

  // Địa Giới (Zone) nơi quái rớt ra item này, = zone chứa Stage đang
  // hoạt động lúc tạo instance (xem GameManager.grantItemDrops(),
  // ZoneRegistry.getZoneForStage()) — undefined khi tạo qua đường
  // không có Stage context (vd obtainEquipment() debug helper). Dùng
  // làm tiền tố "Địa Giới" trong tên ghép động (EquipmentNaming.ts),
  // KHÔNG liên quan grade (phẩm trang bị) ở trên.
  zoneId?: string

  icon?: string

  mainStat: StatModifier

  affixes: RolledAffix[]

  forgeUsesTotal: number

  forgeUsesRemaining: number

  // Hóa Luyện guards (2026-08-25, resource-professions-rework plan
  // §7.5) — item locked/favorite bị loại khỏi danh sách phân giải.
  locked?: boolean

  favorite?: boolean
}
