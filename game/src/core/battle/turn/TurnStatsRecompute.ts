// R4 (AR-19) — Recomputes effective battle stats from the already-resolved base
// and active stat modifiers extracted directly from the canonical BuffSystem.
//
// ARCH-002 (M7): the third argument carries the battle-scoped LIVE modifier
// set (passive stacks, persistent pool, timed/socket mods) supplied by the
// battle ops provider — see TurnBattleSystem.liveStatModifiers. The provider
// returns modifiers only; this function stays the single resolved->effective
// assembly site (calculateEffectiveStats, no attribute re-derivation).
import type { Stats } from '../../stats/StatBlock'
import { calculateEffectiveStats, type StatModifier } from '../../stats/StatCalculator'
import type { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'

export function recomputeEffectiveStats(
  resolvedBase: Stats,
  buffs: BuffPool,
  liveModifiers: StatModifier[] = [],
): Stats {
  const modifiers = new BuffSystem(buffs).getActiveModifiers()

  return calculateEffectiveStats(resolvedBase, [...modifiers, ...liveModifiers])
}
