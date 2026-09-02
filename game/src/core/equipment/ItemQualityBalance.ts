import type { AffixPool } from './Affix'
import type { ItemQuality } from '../item/ItemQuality'

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
