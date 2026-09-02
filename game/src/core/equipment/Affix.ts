import type { StatType } from '../stats/StatTypes'
import type { EquipmentSlot } from './EquipmentTypes'

export type AffixKind = 'prefix' | 'suffix'

// Equipment Rework (2026-08-14) — chia affix thành 4 tầng, mở dần theo
// Quality (ITEM_QUALITY_UNLOCKED_POOLS trong ItemQualityBalance.ts).
// 'supreme' còn là pool DUY NHẤT "Exalted Affix" (roll bonus của
// quality tien cao nhất, xem ITEM_QUALITY_EXALTED_AFFIX_CHANCE trong
// ItemQualityBalance.ts) được phép rút ra, bất kể Quality của item đó
// có tự mở pool 'supreme' hay không — phần thưởng may mắn của quality
// cao nhất, không phụ thuộc trần Tier thường.
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
 * RolledAffix.ts) — số lượng Affix 1 item mang được do QUALITY quyết
 * định (ITEM_QUALITY_AFFIX_SLOTS), tier cao nhất roll được do QUALITY
 * quyết định (ITEM_QUALITY_AFFIX_TIER) — cùng 1 trục ItemQuality gate
 * cả 2 chiều (số lượng lẫn sức mạnh affix).
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
