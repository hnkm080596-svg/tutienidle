// SocketedModifierItem (2026-08-24, resource-professions-rework sec7.2) -
// state Phu/Tran da socket tren equipment slot: MOI item cap DUNG HAI
// modifier (tuple enforced boi type + validator), gan theo SLOT (khong
// theo instance), chi active khi slot dang co equipment.
import type { StatModifier } from '../stats/StatCalculator'

/** Tuple DUNG HAI modifier - compiler + validator cung enforce. */
export type TwoModifiers = readonly [StatModifier, StatModifier]

export interface SocketedModifierItem {
  /** Id TEMPLATE (Phu/Tran trong registry) - unsocket tra template nay. */
  itemId: string

  realmId: string

  modifiers: TwoModifiers
}
