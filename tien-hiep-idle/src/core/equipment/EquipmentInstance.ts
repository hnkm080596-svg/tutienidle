import type { EquipmentSlot } from './EquipmentTypes'
import type { EquipmentQuality } from './EquipmentQuality'
import type { EquipmentRarity } from './EquipmentRarity'
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
 * với phẩm chất/độ hiếm/dòng affix hoàn toàn khác nhau.
 *
 * MASTER SPEC Mục XVI (Phase 9) — enhanceLevel/socketedFormation/
 * bonusAffixSlots đã CHUYỂN sang EquipmentSlotState (gắn theo SLOT,
 * không theo instance) — instance giờ chỉ giữ những gì THẬT SỰ gắn
 * liền với 1 món đồ cụ thể: quality/rarity/affixes (Tẩy Luyện/Nâng
 * Phẩm/Thêm Dòng/Nâng Cấp Dòng), mainStat (Tinh Luyện — Equipment
 * Rework, reroll implicit) và forgePoints (Rèn — Equipment Rework,
 * đầu tư sức mạnh deterministic).
 *
 * Core Loop Foundation checklist (Mục AFFIX) — `substats` cũ (roll
 * ngẫu nhiên, không phân loại) đã bị THAY THẾ HOÀN TOÀN bởi `affixes`
 * (Prefix/Suffix có Tier, xem Affix.ts/RolledAffix.ts). `quality` giờ
 * KHÔNG còn tự roll gì — chỉ còn vai trò GATE tier affix cao nhất có
 * thể roll (xem EQUIPMENT_QUALITY_MAX_AFFIX_TIER trong EquipmentQuality.ts).
 */
export interface EquipmentInstance {
  instanceId: string

  itemId: string

  slot: EquipmentSlot

  equipped: boolean

  quality: EquipmentQuality

  // Core Loop Foundation checklist — trục ĐỘC LẬP với quality (xem
  // EquipmentRarity.ts), quyết định số Affix (Prefix/Suffix) tối đa.
  // Roll riêng theo trọng số (EQUIPMENT_RARITY_DROP_WEIGHT) — rarity
  // cao nhất (thien_duyen) có thêm cơ hội roll 1 "Exalted Affix" bonus,
  // xem EquipmentSystem.createInstance().
  rarity: EquipmentRarity

  // Cảnh giới của trang bị, = player.realmId lúc rớt/tạo ra —
  // dùng cho nâng cảnh giới (Phase 8).
  realmId: string

  // Địa Giới (Zone) nơi quái rớt ra item này, = zone chứa Stage đang
  // hoạt động lúc tạo instance (xem GameManager.grantItemDrops(),
  // ZoneRegistry.getZoneForStage()) — undefined khi tạo qua đường
  // không có Stage context (vd obtainEquipment() debug helper). Dùng
  // làm tiền tố "Địa Giới" trong tên ghép động (EquipmentNaming.ts),
  // KHÔNG liên quan realmId (cảnh giới TU LUYỆN) ở trên.
  zoneId?: string

  mainStat: StatModifier

  affixes: RolledAffix[]

  // Equipment Rework (2026-08-14) — thay thế refineLevel cũ, xem
  // EquipmentSystem.forge()/EQUIPMENT_QUALITY_MAX_FORGE_POINTS.
  forgePoints: number

  // "EquipemtnQuality&rarity" pass (2026-08-14) — Tiềm Năng Rèn, roll
  // ngẫu nhiên ĐỘC LẬP với quality (0-100, xem EquipmentSystem.
  // rollForgePotential()). Quality (Phẩm Chất) quyết định TRẦN chung
  // của tier (EQUIPMENT_QUALITY_MAX_FORGE_POINTS), forgePotential
  // quyết định INSTANCE này thực nhận bao nhiêu % của trần đó — xem
  // EquipmentSystem.getMaxForgePoints(). 2 item CÙNG quality có thể có
  // trần Rèn khác hẳn nhau tuỳ độ may khi rớt.
  forgePotential: number
}
