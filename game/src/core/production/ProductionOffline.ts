import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type {
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
} from './ProductionTypes'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  PRODUCTION_OFFLINE_CAP_SECONDS,
  computeCycleSeconds,
} from './ProductionBalance'
import { allocateWorkerSlots } from './WorkerAllocator'
import { advanceWorkerLanes } from './WorkerLaneAdvance'

/**
 * Offline settle (plan §4.3) — tach khoi ProductionSystem
 * (large-file-split): policy catch-up (ngan sach PRODUCTION_OFFLINE_CAP,
 * forfeit backlog, worker-cycle window) song hanh voi tickWorkers
 * online qua CUNG allocateWorkerSlots + grantCycleRewards — online va
 * offline dung mot quy tac phan bo/settle.
 *
 * M11 (ARCH-007): worker-cycle advancement shares the SAME mechanism
 * advanceWorkerLanes (WorkerLaneAdvance.ts) with tickWorkers — per-lane
 * deadline chaining replaces the pooled floor(windowMs * slots / cycleMs).
 */
export interface ProductionOfflineDeps {
  states: Map<string, ProductionSiteState>

  getSiteDefinition: (siteId: string) => ProductionSiteDefinition | undefined

  grantCycleRewards: (
    cycle: ProductionCycle,
    bag: MaterialBag,
    registry: MaterialRegistry,
  ) => void
}

export interface ProductionOfflineOptions {
  workerCapacity?: number
  offlineSinceMs?: number
  /** Chi-hien-quan — assignments snapshot (từ states trước settle) để
   *  offline khớp online. */
  workerAssignments?: Map<string, number>
}

export function settleProductionOffline(
  deps: ProductionOfflineDeps,
  bag: MaterialBag,
  registry: MaterialRegistry,
  currentRealmId: string,
  nowMs: number = Date.now(),
  options: ProductionOfflineOptions = {},
): number {
  // Mission D (spec D3) — workers-as-fuel: the manual activeCycle path
  // is gone; offline settle is exactly the worker-lane phase under the
  // full PRODUCTION_OFFLINE_CAP budget.
  return settleWorkersOffline(
    deps,
    bag,
    registry,
    currentRealmId,
    nowMs,
    PRODUCTION_OFFLINE_CAP_SECONDS * 1000,
    Math.floor(options.workerCapacity ?? 0),
    options.offlineSinceMs,
    options.workerAssignments,
  )
}

/**
 * Offline settle cho worker cycles (T3) — toàn bộ ngân sách cap
 * (Mission D: không còn manual phase ăn budget trước).
 *
 * M11 (ARCH-007): each site runs `slots` parallel worker LANES inside the
 * [offlineSinceMs, nowMs] window — one sequential cycle chain per lane on
 * its OWN deadline, via the same advanceWorkerLanes mechanism as
 * tickWorkers (driver 'deadline'). Pending cycles past nowMs keep their
 * original lane/deadline for the online tickWorkers; completions over the
 * remaining budget are forfeited. Fractional lane time is never pooled
 * into a synthetic cycle.
 *
 * Chi-hien-quan (2026-09-02): `workerAssignments` — cùng phân bổ manual
 * của tickWorkers để OFFLINE KHỚP ONLINE (spec §6).
 */
function settleWorkersOffline(
  deps: ProductionOfflineDeps,
  bag: MaterialBag,
  registry: MaterialRegistry,
  currentRealmId: string,
  nowMs: number,
  budgetRemainingMs: number,
  workerCapacity: number,
  offlineSinceMs?: number,
  workerAssignments?: Map<string, number>,
): number {
  // R7 (AR-07): the SAME pure allocator as tickWorkers - online and
  // offline settlement share one distribution rule (manual first,
  // remainder round-robins unassigned sites, leftover idle).
  const activeStates = [...deps.states.values()].filter((state) => state.autoRestart)

  // Same order as tickWorkers: slots zero out on every state first.
  for (const state of deps.states.values()) {
    state.activeWorkerSlots = 0
  }

  // workerCapacity <= 0 mirrors the online early-return (tickWorkers
  // freezes workerCycles entirely when capacity is 0). Budget 0 must
  // STILL run: due cycles forfeit under the cap instead of lingering
  // past-due for a free online grant.
  if (activeStates.length === 0 || workerCapacity <= 0) {
    return 0
  }

  const slotsBySite = allocateWorkerSlots(
    activeStates.map((state) => state.siteId),
    workerAssignments ?? new Map<string, number>(),
    workerCapacity,
  )

  for (const state of activeStates) {
    state.activeWorkerSlots = slotsBySite.get(state.siteId) ?? 0
  }

  let settled = 0

  let budgetMs = budgetRemainingMs

  for (const state of activeStates) {
    const slots = slotsBySite.get(state.siteId) ?? 0

    const definition = deps.getSiteDefinition(state.siteId)

    const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM[currentRealmId]

    const cycleMs =
      definition && baseSeconds ? computeCycleSeconds(baseSeconds, state.level) * 1000 : 0

    state.workerCycles ??= []

    // M11 (ARCH-007) — per-lane advancement via the SAME mechanism as
    // tickWorkers (advanceWorkerLanes): each lane completes on its OWN
    // deadline; pending cycles keep their lane + original deadline;
    // empty lanes produce only from the save instant (offlineSinceMs).
    // No floor(windowMs * slots / cycleMs) pooling across lanes.
    // Completions over the budget are forfeited — past-due backlog is
    // never left behind for a free online grant outside the cap.
    const result = advanceWorkerLanes({
      siteId: state.siteId,
      collectionRealmId: currentRealmId,
      siteLevel: state.level,
      baseSeconds: baseSeconds ?? 0,
      cycleMs,
      pending: state.workerCycles,
      slots,
      nowMs,
      emptyLaneStartMs: offlineSinceMs,
      advanceMode: 'deadline',
      budgetMs,
    })

    state.workerCycles = result.pending

    budgetMs -= result.consumedBudgetMs

    for (const cycle of result.completed) {
      deps.grantCycleRewards(cycle, bag, registry)

      settled += 1
    }
  }

  return settled
}
