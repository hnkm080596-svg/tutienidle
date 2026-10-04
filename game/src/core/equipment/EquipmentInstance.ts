import type { EquipmentSlot } from './EquipmentTypes'
import type { ItemQuality } from '../item/ItemQuality'
import type { ProfessionGrade } from '../profession/ProfessionGrade'
import type { RolledAffix } from './RolledAffix'
import type { StatModifier } from '../stats/StatCalculator'
import type { PassiveTrigger } from '../skill/SkillTypes'

export interface SocketedFormation {
  formationId: string

  trigger: PassiveTrigger

  // Ban copy song cua modifier template - stack tich rieng theo SLOT
  // (Phase 9, xem EquipmentSlotState.ts), mat het khi unsocket (xem
  // FormationSystem.ts). Doi trang bi trong slot KHONG mat stack.
  modifiers: StatModifier[]
}

/**
 * Mot ban instance cu the ma nguoi choi so huu, tach khoi Equipment
 * (template tinh trong registry). Khac ban thiet ke cu (tham chieu
 * thang template.modifiers): instance gio tu mang chi so DA ROLL
 * (mainStat/affixes) - cung 1 template co the sinh ra nhieu instance
 * voi pham cap/chat luong/dong affix hoan toan khac nhau.
 *
 * MASTER SPEC Muc XVI (Phase 9) - enhanceLevel/socketedFormation/
 * bonusAffixSlots da CHUYEN sang EquipmentSlotState (gan theo SLOT,
 * khong theo instance) - instance gio chi giu nhung gi THAT SU gan
 * lien voi 1 mon do cu the: grade/quality/affixes, mainStat va ngan sach
 * forgeUses cho Tay Luyen/Tinh Luyen.
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

  // Dia Gioi (Zone) noi quai rot ra item nay, = zone chua Stage dang
  // hoat dong luc tao instance (xem GameManager.grantItemDrops(),
  // ZoneRegistry.getZoneForStage()) - undefined khi tao qua duong
  // khong co Stage context (vd obtainEquipment() debug helper). Dung
  // lam tien to "Dia Gioi" trong ten ghep dong (EquipmentNaming.ts),
  // KHONG lien quan grade (pham trang bi) o tren.
  zoneId?: string

  icon?: string

  mainStat: StatModifier

  affixes: RolledAffix[]

  forgeUsesTotal: number

  forgeUsesRemaining: number

  // Hoa Luyen guards (2026-08-25, resource-professions-rework plan
  // sec7.5) - item locked/favorite bi loai khoi danh sach phan giai.
  locked?: boolean

  favorite?: boolean
}
