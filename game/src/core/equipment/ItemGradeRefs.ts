import {
  ITEM_QUALITY_LABELS,
  ITEM_QUALITY_ORDER,
  composeItemQualityNameSegments,
  type ItemQuality,
} from '../item/ItemQuality'
import { ITEM_QUALITY_DROP_WEIGHT } from './ItemQualityBalance'

export type { ItemQuality as ItemGrade } from '../item/ItemQuality'

export const ITEM_GRADE_ORDER = ITEM_QUALITY_ORDER
export const ITEM_GRADE_LABELS = ITEM_QUALITY_LABELS
export const composeItemGradeNameSegments = composeItemQualityNameSegments

export type EquipmentRarity = ItemQuality

export interface EquipmentRarityAffixSlots {
  prefix: number
  suffix: number
}

export const EQUIPMENT_RARITY_AFFIX_SLOTS: Record<
  ItemQuality,
  EquipmentRarityAffixSlots
> = {
  hoang: { prefix: 0, suffix: 0 },
  huyen: { prefix: 1, suffix: 1 },
  dia: { prefix: 2, suffix: 1 },
  thien: { prefix: 2, suffix: 2 },
  tien: { prefix: 3, suffix: 3 },
}

export const EQUIPMENT_RARITY_LABELS = ITEM_QUALITY_LABELS
export const EQUIPMENT_RARITY_DROP_WEIGHT = ITEM_QUALITY_DROP_WEIGHT
