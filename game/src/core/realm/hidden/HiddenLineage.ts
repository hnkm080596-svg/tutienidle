// Hidden Perfection Lineage (design 2026-09-23, master spec sec.2.3/sec.4) -
// the ONE authority over hidden-perfection state. Every read a consumer
// needs (cap bonus count, eligibility, discovery, completion) and every
// write the system permits (discover, complete, record breakthrough,
// close lineage) is a function here; nothing else reaches into
// player.hiddenPerfection.
//
// Exactly two breakthrough types exist (design sec.5): 'normal' and
// 'hidden'. resolveBreakthroughType is the only resolver - it reads
// everything at commit evaluation time.

import {
  HIDDEN_BODY_REALMS,
  isAuthoredHiddenRealm,
  nextUncompletedHiddenBodyRealm,
} from '../../../data/realm/HiddenBodyRealms'
import { EXTENDED_REALM_LEVEL, getRealmIndex } from '../realmSystem'
import { MAIN_STAT_KEYS } from '../../stats/StatTypes'
import { getEffectiveMainStatCap } from '../../stats/StatCap'
import { canTriggerBreakthrough } from '../BreakthroughGate'
import type {
  HiddenPerfectionState,
  RealmHiddenState,
} from './HiddenPerfection'

export type { HiddenPerfectionState, RealmHiddenState } from './HiddenPerfection'

export type BreakthroughType = 'normal' | 'hidden'

/** Narrow player surface every function in this module consumes. */
export interface HiddenLineagePlayer {
  realmId: string
  realmLevel: number
  baseStats: Record<string, number>
  completedStageIds: readonly string[]
  hiddenPerfection?: HiddenPerfectionState
}

// ---------------------------------------------------------------------------
// Derived reads

export function getHiddenPerfection(
  player: Pick<HiddenLineagePlayer, 'hiddenPerfection'>,
): HiddenPerfectionState | undefined {
  return player.hiddenPerfection
}

/** The lineage is open until ANY normal breakthrough success closes it. */
export function isHiddenLineageOpen(
  player: Pick<HiddenLineagePlayer, 'hiddenPerfection'>,
): boolean {
  return player.hiddenPerfection?.lineageActive === true
}

/** Total completed hidden bodies - the sole source of the +10pp cap bonus. */
export function getCompletedHiddenBodyCount(
  player: Pick<HiddenLineagePlayer, 'hiddenPerfection'>,
): number {
  return player.hiddenPerfection?.completedHiddenBodyRealmIds.length ?? 0
}

export function isHiddenBodyCompleted(
  player: Pick<HiddenLineagePlayer, 'hiddenPerfection'>,
  realmId: string,
): boolean {
  return player.hiddenPerfection?.completedHiddenBodyRealmIds.includes(realmId) === true
}

/** The player broke through INTO realmId via a hidden breakthrough. */
export function wasHiddenBreakthrough(
  player: Pick<HiddenLineagePlayer, 'hiddenPerfection'>,
  realmId: string,
): boolean {
  return player.hiddenPerfection?.hiddenBreakthroughRealmIds.includes(realmId) === true
}

export function isHiddenRealmDiscovered(
  player: Pick<HiddenLineagePlayer, 'hiddenPerfection'>,
  realmId: string,
): boolean {
  return player.hiddenPerfection?.realms[realmId]?.discovered === true
}

export function getRealmHiddenState(
  player: Pick<HiddenLineagePlayer, 'hiddenPerfection'>,
  realmId: string,
): RealmHiddenState | undefined {
  return player.hiddenPerfection?.realms[realmId]
}

/**
 * Strict-prefix progression gate (design sec.7): the lineage must be open,
 * the realm must be authored, it must be THE next uncompleted body
 * realm in registry order, and the player must be IN that realm -
 * a hidden body can never progress retroactively after the player has
 * left its realm. Discovery, mechanism progress and body completion
 * all gate on this - a realm may never skip the queue.
 */
export function canProgressHiddenBody(
  player: Pick<HiddenLineagePlayer, 'hiddenPerfection' | 'realmId'>,
  realmId: string,
): boolean {
  const state = player.hiddenPerfection
  if (state === undefined || !state.lineageActive) {
    return false
  }

  if (!isAuthoredHiddenRealm(realmId)) {
    return false
  }

  if (player.realmId !== realmId) {
    return false
  }

  return nextUncompletedHiddenBodyRealm(state.completedHiddenBodyRealmIds)?.realmId === realmId
}

// ---------------------------------------------------------------------------
// Mutators (each guards its own contract and returns the state it touched)

/**
 * The sole discovery writer (sec.4 no-leak): creates the realm's entry
 * with discovered = true. Hard-gated on canProgressHiddenBody - a
 * closed lineage or out-of-prefix realm can never be discovered, and
 * the write is idempotent for an already-discovered realm.
 */
export function discoverHiddenRealm(
  player: HiddenLineagePlayer,
  realmId: string,
): RealmHiddenState | undefined {
  if (player.hiddenPerfection === undefined || !canProgressHiddenBody(player, realmId)) {
    return undefined
  }

  const realms = player.hiddenPerfection.realms
  const entry = (realms[realmId] ??= {})
  entry.discovered = true
  return entry
}

/**
 * The sole bodyCompleted writer: strict prefix + open lineage. The
 * mechanism's own finished-condition is the caller's precondition (the
 * caller reports the mechanism finished; this mutator trusts but
 * records). Idempotent: completing an already-completed realm is a
 * no-op returning the existing entry.
 */
export function completeHiddenBody(
  player: HiddenLineagePlayer,
  realmId: string,
): RealmHiddenState | undefined {
  const state = player.hiddenPerfection
  if (state === undefined) {
    return undefined
  }

  if (state.completedHiddenBodyRealmIds.includes(realmId)) {
    return state.realms[realmId]
  }

  if (!canProgressHiddenBody(player, realmId)) {
    return undefined
  }

  const entry = (state.realms[realmId] ??= {})
  entry.discovered = true
  entry.bodyCompleted = true
  state.completedHiddenBodyRealmIds.push(realmId)
  return entry
}

/**
 * Frozen-completion reader registry (sibling missions B/C): keyed by
 * the mechanism kind in HIDDEN_BODY_REALMS[].mechanicKind. A reader
 * reports whether the mechanism's persisted payload means "finished"
 * - closeHiddenLineage freezes exactly the realms whose mechanism
 * finished while the body never completed.
 */
export const HIDDEN_MECHANIC_FINISHED_READERS: Record<
  string,
  (payload: NonNullable<RealmHiddenState['mechanic']>) => boolean
> = {}

/**
 * The one-way latch (design sec.3.3): called by the breakthrough-commit
 * sites on ANY normal-breakthrough SUCCESS - never on failure, never
 * on a hidden commit. Sets the diagnostic closer id and freezes every
 * authored realm whose mechanism reports finished but whose body was
 * never completed. Idempotent: a closed lineage stays closed.
 *
 * `closingRealmId` is the DEPARTING realm (the realm whose normal
 * breakthrough was committed), not the entered realm.
 */
export function closeHiddenLineage(
  player: HiddenLineagePlayer,
  closingRealmId: string,
): void {
  const state = player.hiddenPerfection
  if (state === undefined || !state.lineageActive) {
    return
  }

  state.lineageActive = false
  state.lineageClosedByRealmId = closingRealmId

  const completed = new Set(state.completedHiddenBodyRealmIds)
  for (const realm of HIDDEN_BODY_REALMS) {
    if (completed.has(realm.realmId)) {
      continue
    }

    const entry = state.realms[realm.realmId]
    const payload = entry?.mechanic
    if (payload === undefined) {
      continue
    }

    const isFinished = HIDDEN_MECHANIC_FINISHED_READERS[realm.mechanicKind]
    if (isFinished !== undefined && isFinished(payload)) {
      entry!.frozen = true
    }
  }
}

/**
 * Records a hidden breakthrough commit: the entered realm id is pushed
 * onto hiddenBreakthroughRealmIds exactly once. The caller (commit
 * site) has already written player.realmId - the record verifies the
 * entered realm is the realm now occupied, keeps the lineage open, and
 * requires the entered realm to be a legal (non-root) realm. Fail-
 * closed: an incoherent call writes nothing.
 */
export function recordHiddenBreakthrough(
  player: HiddenLineagePlayer,
  enteredRealmId: string,
): boolean {
  const state = player.hiddenPerfection
  if (state === undefined || !state.lineageActive) {
    return false
  }

  if (
    enteredRealmId === 'mortal' ||
    getRealmIndex(enteredRealmId) <= 0 ||
    player.realmId !== enteredRealmId
  ) {
    return false
  }

  if (state.hiddenBreakthroughRealmIds.includes(enteredRealmId)) {
    return true
  }

  state.hiddenBreakthroughRealmIds.push(enteredRealmId)
  return true
}

// ---------------------------------------------------------------------------
// Breakthrough type resolution (sec.4 of the master spec)

/**
 * The eligibility predicate design sec.5/sec.6 requires for a hidden commit:
 *   realmLevel >= EXTENDED_REALM_LEVEL (18)
 *   lineage still open
 *   current realm's hidden body completed
 *   all five main stats at the EFFECTIVE cap (hidden bonus included)
 *   every ordinary breakthrough requirement met
 *
 * Written over PlayerData-shaped state at commit evaluation time:
 * mortal evaluates inside the chooseCultivationPath commit; tribulation
 * realms evaluate inside TribulationDirector.start before the attempt.
 * Nothing else consults this read - the gates row/visibility code NEVER
 * surfaces it (sec.5 visibility law).
 */
export function isHiddenBreakthroughEligible(player: HiddenLineagePlayer): boolean {
  const state = player.hiddenPerfection
  if (state === undefined || !state.lineageActive) {
    return false
  }

  if (player.realmLevel < EXTENDED_REALM_LEVEL) {
    return false
  }

  if (!isHiddenBodyCompleted(player, player.realmId)) {
    return false
  }

  const cap = getEffectiveMainStatCap(player)
  for (const key of MAIN_STAT_KEYS) {
    if ((player.baseStats[key] ?? 0) < cap) {
      return false
    }
  }

  return canTriggerBreakthrough(player)
}

/**
 * Exactly two outcomes (design sec.5.1): a commit resolves 'hidden' only
 * when the full hidden-eligibility contract holds; every other commit
 * is 'normal' - including commits whose player satisfies SOME hidden
 * inputs (level >= 18) but not all.
 */
export function resolveBreakthroughType(player: HiddenLineagePlayer): BreakthroughType {
  return isHiddenBreakthroughEligible(player) ? 'hidden' : 'normal'
}
