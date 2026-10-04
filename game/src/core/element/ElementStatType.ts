import type { ElementType } from './ElementType'

export type ElementStatSuffix =
  | 'Power'
  | 'Resistance'
  | 'Penetration'

// Template literal type - tu sinh 15 key (woodPower...waterPenetration)
// type-safe, ghep vao StatType (xem core/stats/StatTypes.ts) de tai
// dung nguyen StatModifier/calculateStats hien co, khong can he
// thong modifier rieng cho Element.
export type ElementStatType = `${ElementType}${ElementStatSuffix}`
