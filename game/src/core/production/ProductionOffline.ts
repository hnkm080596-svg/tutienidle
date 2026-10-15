import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type {
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
} from './ProductionTypes'
import {
  productionBaseSeconds,
  PRODUCTION_OFFLINE_CAP_SECONDS,
  computeCycleSeconds,
} from './ProductionBalance'
import { advanceWorkerLanes } from './WorkerLaneAdvance'

/** Offline catch-up shares cycle grants with the online production owner. */
export interface ProductionOfflineDeps {
  states: Map<string, ProductionSiteState>

  getSiteDefinition: (siteId: string) => ProductionSiteDefinition | undefined

  grantCycleRewards: (
    cycle: ProductionCycle,
    bag: MaterialBag,
    registry: MaterialRegistry,
  ) => void

  /**
   * GP-01 - the FIELD epoch clock (what the live tick reads the
   * persisted completesAtMs stamps against). ProductionSystem forwards
   * the shared TimeAuthority; absent = wall clock (pre-migration
   * behavior for direct-construction fixtures).
   */
  fieldNow?: () => number
}

export interface ProductionOfflineOptions {
  offlineSinceMs?: number
  rng?: () => number
}

export function settleProductionOffline(
  deps: ProductionOfflineDeps,
  bag: MaterialBag,
  registry: MaterialRegistry,
  currentRealmId: string,
  nowMs: number = Date.now(),
  options: ProductionOfflineOptions = {},
): number {
  // Offline production uses the full configured cap for pending cycles.
  return settleProductionCyclesOffline(
    deps,
    bag,
    registry,
    currentRealmId,
    nowMs,
    PRODUCTION_OFFLINE_CAP_SECONDS * 1000,
    options.offlineSinceMs,
    options.rng,
  )
}

/** Settle retained cycles and one active cycle per site within the offline window. */
function settleProductionCyclesOffline(
  deps: ProductionOfflineDeps,
  bag: MaterialBag,
  registry: MaterialRegistry,
  currentRealmId: string,
  nowMs: number,
  budgetRemainingMs: number,
  offlineSinceMs?: number,
  rng?: () => number,
): number {
  // Retained cycles keep their deadlines even after a site is disabled.
  // Only a total absence of work skips the pass.
  const advanceableStates = [...deps.states.values()].filter(
    (state) => state.autoRestart || (state.productionCycles?.length ?? 0) > 0,
  )
  if (advanceableStates.length === 0) {
    return 0
  }


  let settled = 0

  for (const state of advanceableStates) {
    const slots = state.autoRestart ? 1 : 0

    const definition = deps.getSiteDefinition(state.siteId)

    const baseSeconds = definition ? productionBaseSeconds(definition.kind, currentRealmId) : 0

    const cycleMs =
      definition && baseSeconds ? computeCycleSeconds(baseSeconds, state.level) * 1000 : 0

    state.productionCycles ??= []

    // Advance the site's single cycle chain through the authorized
    // offline window. Over-budget completions are forfeited so backlog
    // cannot be granted later outside the cap.
    const result = advanceWorkerLanes({
      siteId: state.siteId,
      collectionRealmId: currentRealmId,
      siteLevel: state.level,
      baseSeconds: baseSeconds ?? 0,
      cycleMs,
      pending: state.productionCycles,
      slots,
      nowMs,
      emptyLaneStartMs: offlineSinceMs,
      advanceMode: 'deadline',
      // Each site owns its full allowance; sibling order cannot spend it.
      budgetMs: budgetRemainingMs,
      rng,
    })

    // r16-INT-03 + r17-INT-01 + r18-COR-4: chains ROOTED at a
    // settle-time seed (emptyLaneStartMs) encode "remaining work at
    // settle" - their pending head owes its next completion relative
    // to the settle's nowMs, whatever epoch anchored the seed (server
    // bound, recent marker, or crafted deep-past). Persisting those
    // stamps raw into productionCycles - which online ticks reads against
    // Date.now() - paid them early under any positive skew (and paid
    // ~1 cycle instantly for deep-past windows). Re-stamp exactly the
    // seed-rooted heads into the field epoch; successors of SAVED
    // lanes keep the lane's own client-epoch deadline. One-way shift
    // only: a slow field clock leaves deadlines ahead of fieldNow, the
    // bounded underpay direction. GP-01: fieldNow is the authority the
    // live tick reads - NOT the raw wall clock, which a user can move.
    const fieldEpochShiftMs = Math.max(0, (deps.fieldNow?.() ?? Date.now()) - nowMs)
    const seededHeads = new Set(result.seededPending)
    state.productionCycles = result.pending.map((cycle) =>
      // r32-AUT-4: the re-stamp must not mint out-of-domain either - a
      // crafted wall clock far ahead of the settle epoch would push the
      // shifted stamps >= 2^52 and self-refuse the next save write.
      // completesAtMs is the pair's largest stamp (ordering pin), so it
      // alone decides headroom; a head that cannot shift cleanly keeps
      // the settle-epoch stamps verbatim (parked, deny).
      fieldEpochShiftMs > 0 && seededHeads.has(cycle) && cycle.completesAtMs + fieldEpochShiftMs < 2 ** 52
        ? {
            ...cycle,
            startedAtMs: cycle.startedAtMs + fieldEpochShiftMs,
            completesAtMs: cycle.completesAtMs + fieldEpochShiftMs,
          }
        : cycle,
    )

    for (const cycle of result.completed) {
      deps.grantCycleRewards(cycle, bag, registry)

      settled += 1
    }
  }

  return settled
}
