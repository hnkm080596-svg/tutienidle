import type { ElementType } from './ElementType'

export type ElementStatSuffix =
  | 'Power'
  | 'Resistance'
  | 'Penetration'

// Template literal type — tự sinh 15 key (woodPower...waterPenetration)
// type-safe, ghép vào StatType (xem core/stats/StatTypes.ts) để tái
// dùng nguyên StatModifier/calculateStats hiện có, không cần hệ
// thống modifier riêng cho Element.
export type ElementStatType = `${ElementType}${ElementStatSuffix}`
