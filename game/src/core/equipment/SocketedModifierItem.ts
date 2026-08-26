// SocketedModifierItem (2026-08-24, resource-professions-rework §7.2) —
// state Phù/Trận đã socket trên equipment slot: MỖI item cấp ĐÚNG HAI
// modifier (tuple enforced bởi type + validator), gắn theo SLOT (không
// theo instance), chỉ active khi slot đang có equipment.
import type { StatModifier } from '../stats/StatCalculator'

/** Tuple ĐÚNG HAI modifier — compiler + validator cùng enforce. */
export type TwoModifiers = readonly [StatModifier, StatModifier]

export interface SocketedModifierItem {
  /** Id TEMPLATE (Phù/Trận trong registry) — unsocket trả template này. */
  itemId: string

  realmId: string

  modifiers: TwoModifiers
}
