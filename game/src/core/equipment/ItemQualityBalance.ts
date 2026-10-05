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

// Gear-pace retune (2026-10-05, balance doc docs/balance/2026-10-05-gear-pace-curve.md):
// the quality a drop may ROLL is capped by the stage floor it dropped on.
// Bands mirror chapter pacing (10 floors per chapter): low floors only hand
// out low qualities so a slot is never finished by one early lucky roll, and
// each band's gear has to be farmed before the next floor wall. The cap only
// binds the BASE roll - applyQualityBonusSteps() still nudges the rolled
// quality upward afterwards (stacked kills keep their upgrade rule), so a
// boss+elite kill remains the rare venue that can reach one band higher.
export interface ItemQualityFloorBand {
  maxFloor: number
  ceiling: ItemQuality
}

export const ITEM_QUALITY_FLOOR_CEILING: readonly ItemQualityFloorBand[] = [
  { maxFloor: 3, ceiling: 'huyen' },
  { maxFloor: 6, ceiling: 'dia' },
  { maxFloor: 9, ceiling: 'thien' },
  { maxFloor: Number.POSITIVE_INFINITY, ceiling: 'tien' },
]

/**
 * Max quality a stage-floor drop may roll. `undefined` floor means the drop
 * carried no stage context (debug/lab grants, auto-farm shims): those keep
 * the legacy flat ladder and are deliberately not re-gated here.
 */
export function itemQualityCeilingForFloor(floor: number | undefined): ItemQuality | undefined {
  if (floor === undefined) {
    return undefined
  }

  for (const band of ITEM_QUALITY_FLOOR_CEILING) {
    if (floor <= band.maxFloor) {
      return band.ceiling
    }
  }

  return 'tien'
}

// Weight per affix tier on the initial roll - hunting high-tier affixes is
// meant to stay a farm loop inside a quality band, so low tiers draw far
// more often than high ones (was: uniform among eligible tiers). Only the
// initial roll consumes this table; wash keeps its own per-quality weights
// (RefinementBalance.ts) and exalted affixes roll at a fixed tier.
export const AFFIX_TIER_ROLL_WEIGHT: Readonly<Record<number, number>> = {
  1: 10,
  2: 6,
  3: 3,
  4: 2,
  5: 1,
}

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
