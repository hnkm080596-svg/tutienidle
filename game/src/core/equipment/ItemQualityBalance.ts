import type { AffixPool } from './Affix'
import { ITEM_QUALITY_ORDER, type ItemQuality } from '../item/ItemQuality'

export const ITEM_QUALITY_DROP_WEIGHT: Record<ItemQuality, number> = {
  hoang: 75,
  huyen: 15,
  dia: 8,
  thien: 1.99,
  tien: 0.01,
}

export const ITEM_QUALITY_SUBSTATS_RANGE: Record<ItemQuality, { min: number; max: number }> = {
  hoang: { min: 0, max: 1 },
  huyen: { min: 0, max: 2 },
  dia: { min: 0, max: 3 },
  thien: { min: 0, max: 4 },
  tien: { min: 0, max: 5 },
}

export const ITEM_QUALITY_FORGE_USES: Record<ItemQuality, number> = {
  hoang: 5,
  huyen: 10,
  dia: 20,
  thien: 40,
  tien: 80,
}

export const ITEM_QUALITY_AFFIX_TIER: Record<ItemQuality, number> = {
  hoang: 1,
  huyen: 2,
  dia: 3,
  thien: 4,
  tien: 5,
}

export const ITEM_QUALITY_UNLOCKED_POOLS: Record<ItemQuality, AffixPool[]> = {
  hoang: ['basic'],
  huyen: ['basic', 'advanced'],
  dia: ['basic', 'advanced', 'specialized'],
  thien: ['basic', 'advanced', 'specialized', 'supreme'],
  tien: ['basic', 'advanced', 'specialized', 'supreme'],
}

export const ITEM_QUALITY_IMPLICIT_MULTIPLIER: Record<ItemQuality, number> = {
  hoang: 1,
  huyen: 1.15,
  dia: 1.3,
  thien: 1.5,
  tien: 1.75,
}

export const ITEM_QUALITY_ESSENCE_RANGE: Record<ItemQuality, { min: number; max: number }> = {
  hoang: { min: 1, max: 3 },
  huyen: { min: 2, max: 4 },
  dia: { min: 3, max: 5 },
  thien: { min: 4, max: 6 },
  tien: { min: 5, max: 7 },
}

export interface ItemQualityAffixSlots {
  prefix: number
  suffix: number
}

// So slot Prefix/Suffix toi da theo quality - bac giua (dia) lech
// prefix truoc suffix (2/1) truoc khi doi xung lai o thien (2/2) roi
// tien (3/3), tranh 1 buoc nhay dot ngot. Chuyen tu
// EquipmentRarity.ts/ItemGradeRefs.ts (item-grade-quality-rework Task
// 22) - cung convention ITEM_QUALITY_* voi cac bang balance khac trong
// module nay.
export const ITEM_QUALITY_AFFIX_SLOTS: Record<ItemQuality, ItemQualityAffixSlots> = {
  hoang: { prefix: 0, suffix: 0 },
  huyen: { prefix: 1, suffix: 1 },
  dia: { prefix: 2, suffix: 1 },
  thien: { prefix: 2, suffix: 2 },
  tien: { prefix: 3, suffix: 3 },
}

// "Exalted Affix" - CHI quality tien moi co co hoi roll them 1 affix
// bonus tu pool 'supreme' (bo qua gioi han slot binh thuong o tren) -
// van random, khong phai item co dinh. Chuyen tu EquipmentRarity.ts
// (item-grade-quality-rework Task 22).
export const ITEM_QUALITY_EXALTED_AFFIX_CHANCE = 0.15

/**
 * Applied AFTER rollItemQuality(), never instead of it (spec E5).
 *
 * The quality ladder is rolled at fixed weights and that roll stays owned by
 * this system; a drop only ever nudges the result. Only equipment has a
 * quality ladder at all, so this is the single place a stacked kill can turn
 * into a better item. (large-file-split: moved from EquipmentSystem.ts -
 * pure function over ITEM_QUALITY_ORDER, song cung bang balance.)
 */
export function applyQualityBonusSteps(quality: ItemQuality, steps: number): ItemQuality {
  if (steps <= 0) {
    return quality
  }

  const index = ITEM_QUALITY_ORDER.indexOf(quality)

  if (index < 0) {
    return quality
  }

  return ITEM_QUALITY_ORDER[Math.min(ITEM_QUALITY_ORDER.length - 1, index + steps)]!
}
