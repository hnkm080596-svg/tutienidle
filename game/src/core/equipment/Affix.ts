import type { StatType } from '../stats/StatTypes'
import type { EquipmentSlot } from './EquipmentTypes'

export type AffixKind = 'prefix' | 'suffix'

// Equipment Rework (2026-08-14) - chia affix thanh 4 tang, mo dan theo
// Quality (ITEM_QUALITY_UNLOCKED_POOLS trong ItemQualityBalance.ts).
// 'supreme' con la pool DUY NHAT "Exalted Affix" (roll bonus cua
// quality tien cao nhat, xem ITEM_QUALITY_EXALTED_AFFIX_CHANCE trong
// ItemQualityBalance.ts) duoc phep rut ra, bat ke Quality cua item do
// co tu mo pool 'supreme' hay khong - phan thuong may man cua quality
// cao nhat, khong phu thuoc tran Tier thuong.
export type AffixPool = 'basic' | 'advanced' | 'specialized' | 'supreme'

export interface AffixTierDef {
  tier: number

  min: number

  max: number
}

/**
 * Core Loop Foundation checklist (Muc AFFIX) - thay the HOAN TOAN
 * substatPool cu (roll ngau nhien N cai, khong phan loai, khong co
 * tier). 1 Affix template roll ra 1 RolledAffix tren instance (xem
 * RolledAffix.ts) - so luong Affix 1 item mang duoc do QUALITY quyet
 * dinh (ITEM_QUALITY_AFFIX_SLOTS), tier cao nhat roll duoc do QUALITY
 * quyet dinh (ITEM_QUALITY_AFFIX_TIER) - cung 1 truc ItemQuality gate
 * ca 2 chieu (so luong lan suc manh affix).
 */
export interface Affix {
  id: string

  name: string

  stat: StatType

  kind: AffixKind

  // Khong khai = roll duoc tren MOI slot - khai thi CHI roll duoc
  // tren dung nhung slot liet ke (vd affix "Sat Thuong Can Chien" chi
  // hop weapon).
  slots?: EquipmentSlot[]

  // Tang dan theo tier - tier[0] la tier thap nhat (1), gia tri lon
  // dan theo index.
  tiers: AffixTierDef[]

  // Equipment Rework - pool mo theo Quality (xem AffixPool o tren).
  pool: AffixPool
}
