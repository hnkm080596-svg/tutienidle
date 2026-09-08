// R4 (AR-19) — Recomputes effective battle stats from the already-resolved base
// and active stat modifiers extracted directly from the canonical BuffSystem.
import type { Stats } from '../../stats/StatBlock'
import { calculateEffectiveStats } from '../../stats/StatCalculator'
import type { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'

export function recomputeEffectiveStats(resolvedBase: Stats, buffs: BuffPool): Stats {
  const modifiers = new BuffSystem(buffs).getActiveModifiers()

  return calculateEffectiveStats(resolvedBase, modifiers)
}
