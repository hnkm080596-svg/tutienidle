import type { ProductionCycle } from './ProductionTypes'
import { buildProductionCycle } from './ProductionCycles'

// M11 (ARCH-007) — per-lane worker-cycle advancement, ONE mechanism with
// two drivers (A9):
//   - online  ProductionSystem.tickWorkers   -> advanceMode 'observe'
//   - offline ProductionOffline worker settle -> advanceMode 'deadline'
//
// Lane model: a site's worker pool is `slots` parallel lanes; each lane
// holds at most one in-flight cycle (state.workerCycles is the set of
// in-flight lane heads). A lane completes ONLY when its own accumulated
// time crosses its own completesAtMs — partial work across lanes never
// pools into a completed cycle. Kept future cycles keep their reserved
// lane capacity and their original deadlines.
//
// Drivers differ only in the observation schedule:
//   - 'observe'  = single tick at nowMs (tickWorkers): due heads grant
//     once; freed lanes stay empty until the NEXT call refills them via
//     emptyLaneStartMs (top-up-then-settle order preserved).
//   - 'deadline' = continuous observation over [emptyLaneStartMs, nowMs]
//     (settleOffline): a completed lane immediately starts its next cycle
//     at the completion instant — the dense limit of the online tick.

export type WorkerLaneAdvanceMode = 'observe' | 'deadline'

export interface WorkerLaneAdvanceParams {
  siteId: string

  /** Snapshot inputs for cycles the mechanism spawns (current realm/level). */
  collectionRealmId: string

  siteLevel: number

  baseSeconds: number

  /** Current cycle duration in ms — successors/empty-lane seeds use it. */
  cycleMs: number

  /** In-flight lane heads from state (saved or tick-carried). */
  pending: readonly ProductionCycle[]

  /** Lanes allocated to this site by allocateWorkerSlots. */
  slots: number

  nowMs: number

  /**
   * Start instant for lanes holding no in-flight cycle. Online passes
   * nowMs (top-up at the tick); offline passes the save timestamp
   * (offlineSinceMs). Undefined = empty lanes stay empty.
   */
  emptyLaneStartMs?: number

  advanceMode: WorkerLaneAdvanceMode

  /**
   * Offline work budget (cap accounting): a completion whose own
   * duration exceeds the remaining budget is FORFEITED (dropped without
   * reward), same rule as the manual backlog forfeit. Undefined = no
   * budget (online path never forfeits).
   */
  budgetMs?: number
}

export interface WorkerLaneAdvanceResult {
  /** Cycles that completed and must be granted by the caller, in completion order. */
  completed: ProductionCycle[]

  /** In-flight lane heads to persist as state.workerCycles. */
  pending: ProductionCycle[]

  /** Completed cycles dropped because the budget could not pay their duration. */
  forfeited: number

  /** Total rewarded duration consumed from budgetMs (0 when no budget). */
  consumedBudgetMs: number
}

interface LaneCursor {
  /** completesAtMs of the lane's in-flight cycle. */
  dueMs: number

  /** startedAtMs of the lane's in-flight cycle. */
  startMs: number

  /** The restored cycle object when the in-flight cycle came from saved state. */
  saved?: ProductionCycle
}

export function advanceWorkerLanes(params: WorkerLaneAdvanceParams): WorkerLaneAdvanceResult {
  const { siteId, collectionRealmId, siteLevel, baseSeconds, cycleMs, slots, nowMs } = params

  // Defensive guard: a non-finite clock or budget can never advance a
  // lane — 'deadline' mode would loop forever because dueMs > NaN and
  // dueMs > Infinity are both always false. Zero-advance result: the
  // in-flight lanes are preserved untouched (no completions, no
  // respawns, no empty-lane seeding).
  if (
    !Number.isFinite(nowMs) ||
    (params.budgetMs !== undefined && !Number.isFinite(params.budgetMs))
  ) {
    return {
      completed: [],
      pending: [...params.pending],
      forfeited: 0,
      consumedBudgetMs: 0,
    }
  }

  const canSpawn = cycleMs > 0 && baseSeconds > 0

  const hasBudget = params.budgetMs !== undefined

  let budgetLeftMs = Math.max(0, params.budgetMs ?? 0)

  // Lane cursors, sorted by deadline: every saved in-flight cycle keeps
  // its own lane, deadline and identity — including lanes beyond the
  // current slot budget (retained work is never killed early).
  const lanes: LaneCursor[] = [...params.pending]
    .map<LaneCursor>((cycle) => ({
      dueMs: cycle.completesAtMs,
      startMs: cycle.startedAtMs,
      saved: cycle,
    }))
    .sort((a, b) => a.dueMs - b.dueMs)

  // Empty lanes are seeded only when the driver knows the window start;
  // they produce from that instant, never before it. Re-sort: a virtual
  // lane's first deadline can precede a saved lane's deadline.
  if (canSpawn && params.emptyLaneStartMs !== undefined) {
    for (let count = lanes.length; count < slots; count += 1) {
      lanes.push({
        startMs: params.emptyLaneStartMs,
        dueMs: params.emptyLaneStartMs + cycleMs,
      })
    }

    lanes.sort((a, b) => a.dueMs - b.dueMs)
  }

  let inFlight = lanes.length

  const completed: ProductionCycle[] = []

  let forfeited = 0

  while (lanes.length > 0) {
    const lane = lanes[0]!

    // Lanes stay sorted by dueMs — once the earliest lane is in the
    // future, every remaining lane is in-flight work to keep.
    if (lane.dueMs > nowMs) {
      break
    }

    lanes.shift()

    inFlight -= 1

    // A completion costs its own full duration (saved cycles use their
    // snapshot duration; spawned cycles always span exactly cycleMs).
    const costMs = Math.max(0, lane.dueMs - lane.startMs)

    if (!hasBudget || costMs <= budgetLeftMs) {
      budgetLeftMs -= costMs

      completed.push(
        lane.saved ??
          buildProductionCycle(siteId, collectionRealmId, siteLevel, baseSeconds, lane.startMs),
      )
    } else {
      forfeited += 1
    }

    if (params.advanceMode === 'deadline' && canSpawn && inFlight < slots) {
      // Continuous driver: the freed lane starts its next cycle at the
      // completion instant and keeps its slot.
      inFlight += 1

      const next: LaneCursor = { startMs: lane.dueMs, dueMs: lane.dueMs + cycleMs }

      let index = 0

      while (index < lanes.length && lanes[index]!.dueMs <= next.dueMs) {
        index += 1
      }

      lanes.splice(index, 0, next)
    }
    // 'observe': the freed lane ends here; the next tick refills it via
    // emptyLaneStartMs — identical to tickWorkers' top-up ordering.
  }

  const pending = lanes.map((lane) =>
    lane.saved ??
    buildProductionCycle(siteId, collectionRealmId, siteLevel, baseSeconds, lane.startMs),
  )

  return {
    completed,
    pending,
    forfeited,
    consumedBudgetMs: hasBudget ? Math.max(0, params.budgetMs ?? 0) - budgetLeftMs : 0,
  }
}
