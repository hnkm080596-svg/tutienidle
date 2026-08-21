import type { StatType } from '../stats/StatTypes'
import type { EquipmentSlot } from './EquipmentTypes'

export type AffixKind = 'prefix' | 'suffix'

// Equipment Rework (2026-08-14) — chia affix thành 4 tầng, mở dần theo
// Quality (EQUIPMENT_QUALITY_UNLOCKED_POOLS trong EquipmentQuality.ts).
// 'supreme' còn là pool DUY NHẤT "Exalted Affix" (roll bonus của
// thien_duyen rarity, xem EquipmentRarity.ts) được phép rút ra, bất kể
// Quality của item đó có tự mở pool 'supreme' hay không — phần
// thưởng may mắn của rarity cao nhất, không phụ thuộc quality.
export type AffixPool = 'basic' | 'advanced' | 'specialized' | 'supreme'

export interface AffixTierDef {
  tier: number

  min: number

  max: number
}

/**
 * Core Loop Foundation checklist (Mục AFFIX) — thay thế HOÀN TOÀN
 * substatPool cũ (roll ngẫu nhiên N cái, không phân loại, không có
 * tier). 1 Affix template roll ra 1 RolledAffix trên instance (xem
 * RolledAffix.ts) — số lượng Affix 1 item mang được do RARITY quyết
 * định (EQUIPMENT_RARITY_AFFIX_SLOTS), tier cao nhất roll được do
 * QUALITY quyết định (EQUIPMENT_QUALITY_MAX_AFFIX_TIER) — 2 trục độc
 * lập cùng gate 1 hệ thống duy nhất.
 */
export interface Affix {
  id: string

  name: string

  stat: StatType

  kind: AffixKind

  // Không khai = roll được trên MỌI slot — khai thì CHỈ roll được
  // trên đúng những slot liệt kê (vd affix "Sát Thương Cận Chiến" chỉ
  // hợp weapon).
  slots?: EquipmentSlot[]

  // Tăng dần theo tier — tier[0] là tier thấp nhất (1), giá trị lớn
  // dần theo index.
  tiers: AffixTierDef[]

  // Equipment Rework — pool mở theo Quality (xem AffixPool ở trên).
  pool: AffixPool
}
