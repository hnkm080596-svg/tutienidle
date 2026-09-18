// R4 (AR-19) — Recomputes effective battle stats from the already-resolved base
// and active stat modifiers supplied by the canonical buff2 BuffSystem query
// (getStatModifiers returns the legacy StatModifier shape incl. stacks).
//
// ARCH-002 (M7): the third argument carries the battle-scoped LIVE modifier
// set (passive stacks, persistent pool, timed/socket mods) supplied by the
// battle ops provider — see TurnBattleSystem.liveStatModifiers. The provider
// returns modifiers only; this function stays the single resolved->effective
// assembly site (calculateEffectiveStats — M9: live moves of the 5 main
// stats additionally derive their DELTA into the attribute-derived stats,
// so e.g. a live attunement stack grows elemental power mid-battle without
// double-deriving the resolved base).
import type { Stats } from '../../stats/StatBlock'
import { calculateEffectiveStats, type StatModifier } from '../../stats/StatCalculator'
import type { StatDomain } from '../../stats/StatDomain'

export function recomputeEffectiveStats(
  resolvedBase: Stats,
  buffModifiers: readonly StatModifier[],
  liveModifiers: StatModifier[] = [],
  activeDomains?: ReadonlySet<StatDomain>,
): Stats {
  return calculateEffectiveStats(resolvedBase, [...buffModifiers, ...liveModifiers], { activeDomains })
}
