import type { StatType } from '../stats/StatTypes'
import type { EquipmentSlot } from './EquipmentTypes'
import type { Equipment } from './Equipment'

export const EQUIPMENT_FORBIDDEN_STATS = [
  'strength',
  'dexterity',
  'intelligence',
  'attunement',
  'vitality',
] as const satisfies readonly StatType[]

export interface EquipmentSlotStatPolicy {
  tendency: 'Công' | 'Thủ' | 'Utility'
  mainStats: readonly StatType[]
  substats: readonly StatType[]
}

const ELEMENT_POWER_STATS = [
  'firePower',
  'woodPower',
  'waterPower',
  'metalPower',
  'earthPower',
] as const
const ELEMENT_PENETRATION_STATS = [
  'firePenetration',
  'woodPenetration',
  'waterPenetration',
  'metalPenetration',
  'earthPenetration',
] as const
const ELEMENT_RESISTANCE_STATS = [
  'fireResistance',
  'woodResistance',
  'waterResistance',
  'metalResistance',
  'earthResistance',
  // Spec 2026-08-30-phap-tu-dao-sac §5 — windResistance/
  // lightningResistance đã xoá cùng element Phong/Lôi.
] as const

export const EQUIPMENT_SLOT_STAT_POLICY: Record<EquipmentSlot, EquipmentSlotStatPolicy> = {
  weapon: {
    tendency: 'Công',
    mainStats: ['might'],
    substats: [
      'criticalRate',
      'criticalDamage',
      'speed',
      'accuracyRating',
      'skillDamagePercent',
      'ailmentPotencyPercent',
      'leechPercent',
      'finalDamagePercent',
      ...ELEMENT_POWER_STATS,
      ...ELEMENT_PENETRATION_STATS,
    ],
  },
  helmet: {
    tendency: 'Thủ',
    mainStats: ['maxHp'],
    substats: [
      'wardMax',
      'wardRegenPerTurn',
      'criticalAvoidance',
      'ailmentResistPercent',
      'dotResistancePercent',
      'finalDamageReductionPercent',
      ...ELEMENT_RESISTANCE_STATS,
    ],
  },
  armor: {
    tendency: 'Thủ',
    mainStats: ['defense'],
    // The Tu Reimagined (spec 2026-09-15 section 3.3): block/endurance
    // are the_tu-domain stats — domain-gated data can't be authored
    // untagged, so they leave the equipment pools entirely.
    // generic thorns stat retired with the stat (spec section 7.13/T12).
    substats: [
      'maxHp',
      'criticalAvoidance',
      'dotResistancePercent',
      'hpRegenPerTurn',
      'finalDamageReductionPercent',
      ...ELEMENT_RESISTANCE_STATS,
    ],
  },
  boots: {
    tendency: 'Thủ',
    mainStats: ['evasionRate'],
    substats: [
      'criticalAvoidance',
      'ailmentResistPercent',
      'hpRegenPerTurn',
      'wardRegenPerTurn',
      'finalDamageReductionPercent',
      ...ELEMENT_RESISTANCE_STATS,
    ],
  },
  ring: {
    tendency: 'Công',
    mainStats: ['criticalRate', 'criticalDamage'],
    substats: [
      'might',
      'speed',
      'accuracyRating',
      'skillDamagePercent',
      'ailmentPotencyPercent',
      'leechPercent',
      'finalDamagePercent',
      ...ELEMENT_POWER_STATS,
    ],
  },
  necklace: {
    tendency: 'Utility',
    // stat-system-reimagined Task 11 (D1/INV-15): speed must never be
    // the only desirable roll in its pool. Rivals stay outside the
    // substat list (mains never reappear there), so the defensive
    // mains are defense/evasionRate rather than wardMax/maxHp.
    mainStats: ['speed', 'defense', 'evasionRate'],
    substats: [
      'wardMax',
      'wardRegenPerTurn',
      'maxHp',
      'criticalAvoidance',
      'ailmentResistPercent',
      'leechPercent',
      'finalDamageReductionPercent',
      ...ELEMENT_RESISTANCE_STATS,
    ],
  },
}

export function isForbiddenEquipmentStat(stat: StatType): boolean {
  return (EQUIPMENT_FORBIDDEN_STATS as readonly StatType[]).includes(stat)
}

export function isValidEquipmentMainStat(slot: EquipmentSlot, stat: StatType): boolean {
  return EQUIPMENT_SLOT_STAT_POLICY[slot].mainStats.includes(stat)
}

export function isValidEquipmentSubstat(slot: EquipmentSlot, stat: StatType): boolean {
  return !isForbiddenEquipmentStat(stat) && EQUIPMENT_SLOT_STAT_POLICY[slot].substats.includes(stat)
}

// Dùng chung bởi GameManager.catalogOps.registerEquipment() (validate 1 lần lúc
// startup, TASK.md yêu cầu) VÀ EquipmentSystem.createInstance() (validate
// lại lúc roll, phòng template lọt qua chưa đăng ký) — tránh 2 nơi tự copy
// cùng 1 rule rồi lệch nhau khi rule đổi.
export function assertValidEquipmentMainStats(
  item: Pick<Equipment, 'id' | 'slot' | 'mainStats'>,
): void {
  if (item.mainStats.length === 0) {
    throw new Error(`Equipment ${item.id} has no main stat range`)
  }

  const invalidMainStat = item.mainStats.find(
    (range) => !isValidEquipmentMainStat(item.slot, range.stat),
  )

  if (invalidMainStat) {
    throw new Error(
      `Invalid main stat ${invalidMainStat.stat} for equipment slot ${item.slot} (${item.id})`,
    )
  }

  const invalidRange = item.mainStats.find(
    (range) => !Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min > range.max,
  )

  if (invalidRange) {
    throw new Error(`Invalid main stat range ${invalidRange.stat} for equipment ${item.id}`)
  }
}
