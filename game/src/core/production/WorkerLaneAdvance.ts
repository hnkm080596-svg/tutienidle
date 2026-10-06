import type { ProductionCycle } from './ProductionTypes'
import { buildProductionCycle } from './ProductionCycles'

// M11 (ARCH-007) - per-lane worker-cycle advancement, ONE mechanism with
// two drivers (A9):
//   - online  ProductionSystem.tickWorkers   -> advanceMode 'observe'
//   - offline ProductionOffline worker settle -> advanceMode 'deadline'
//
// Lane model: a site's worker pool is `slots` parallel lanes; each lane
// holds at most one in-flight cycle (state.workerCycles is the set of
// in-flight lane heads). A lane completes ONLY when its own accumulated
// time crosses its own completesAtMs - partial work across lanes never
// pools into a completed cycle. Kept future cycles keep their reserved
// lane capacity and their original deadlines.
//
// Drivers differ only in the observation schedule:
//   - 'observe'  = single tick at nowMs (tickWorkers): due heads grant
//     once; freed lanes stay empty until the NEXT call refills them via
//     emptyLaneStartMs (top-up-then-settle order preserved).
//   - 'deadline' = continuous observation over [emptyLaneStartMs, nowMs]
//     (settleOffline): a completed lane immediately starts its next cycle
//     at the completion instant - the dense limit of the online tick.

export type WorkerLaneAdvanceMode = 'observe' | 'deadline'

export interface WorkerLaneAdvanceParams {
  siteId: string

  /** Snapshot inputs for cycles the mechanism spawns (current realm/level). */
  collectionRealmId: string

  siteLevel: number

  baseSeconds: number

  /** Current cycle duration in ms - successors/empty-lane seeds use it. */
  cycleMs: number

  /** In-flight lane heads from state (saved or tick-carried). */
  pending: readonly ProductionCycle[]

  /**
   * Lanes allocated to this site by allocateWorkerSlots. Contract: a
   * non-negative integer, bounded - the defensive guard rejects
   * non-integer/negative/>65536 values (a fractional count over-seeds
   * a lane; a huge count makes the seed loop push lanes to OOM).
   */
  slots: number

  nowMs: number

  /**
   * Start instant for lanes holding no in-flight cycle. Online passes
   * nowMs (top-up at the tick); offline passes the authorized window
   * start (offlineSinceMs). Undefined = empty lanes stay empty.
   */
  emptyLaneStartMs?: number

  advanceMode: WorkerLaneAdvanceMode

  /**
   * Offline work budget (cap accounting): a completion whose own
   * duration exceeds the remaining budget is FORFEITED (dropped without
   * reward), same rule as the manual backlog forfeit. Undefined = no
   * budget (online path never forfeits). Caller-owned ceiling: the
   * authorized cap lives upstream (PRODUCTION_OFFLINE_CAP_SECONDS
   * bounds the production settle); a huge finite value is honored by
   * design, the guard only rejects non-finite.
   */
  budgetMs?: number

  /** Seeded stream for rollSeed mints on spawned cycles (GameManager binds sessionRng). */
  rng?: () => number
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

  /**
   * Pending lane heads whose deadline chain is ROOTED at a settle-time
   * seed (spawned from emptyLaneStartMs - offline only), not at a
   * persisted lane deadline. Their stamps encode "remaining work at
   * settle" relative to the settle's nowMs, so the persister re-stamps
   * exactly these into the field epoch; successors of SAVED lanes keep
   * the saved lane's own client-epoch deadline. Same object refs as
   * `pending`.
   */
  seededPending: readonly ProductionCycle[]
}

interface LaneCursor {
  /** completesAtMs of the lane's in-flight cycle. */
  dueMs: number

  /** startedAtMs of the lane's in-flight cycle. */
  startMs: number

  /** The restored cycle object when the in-flight cycle came from saved state. */
  saved?: ProductionCycle

  /**
   * True when this lane's deadline chain is rooted at a settle-time
   * seed spawned from emptyLaneStartMs (successor chains inherit their
   * root). Saved-lane chains never carry it - their deadlines are the
   * lane's own persisted client stamps, not settle constructs.
   */
  seeded?: boolean
}

export function advanceWorkerLanes(params: WorkerLaneAdvanceParams): WorkerLaneAdvanceResult {
  const { siteId, collectionRealmId, siteLevel, baseSeconds, cycleMs, slots, nowMs } = params

  // Defensive guard: a non-finite clock or budget can never advance a
  // lane - 'deadline' mode would loop forever because dueMs > NaN and
  // dueMs > Infinity are both always false. r19-AUT hardening: a
  // non-finite emptyLaneStartMs or pending due hangs the same way
  // (NaN due never breaks the loop, respawns NaN forever) - upstream
  // pins bound every persisted timestamp at |x| < 2^52 (admission),
  // this guard mirrors the mechanism's own 2^53 line for non-save
  // feeds.
  // r20-AUT: the ordering pin too - a reversed/zero span
  // (completesAtMs <= startedAtMs) computes headCost = 0 and would
  // grant a free completion per entry; the validator rejects the same
  // shape upstream (F-A11-4). r20-COR-1/2: magnitude + slots pins -
  // |stamp| >= 2^53 makes stamp + cycleMs absorb back into stamp in
  // float64 (ulp/2 > the delta: headCost = 0 forever, dues never reach
  // nowMs - an unbounded settle loop a crafted deep-past lastSavedAt
  // could reach through the window start, and the same absorb can sit
  // inside a crafted pending pair at mechanism level), and a bad
  // slots makes the seed loop push lanes without bound. r21-INT-01:
  // slots must be a bounded non-negative integer - 1e9 finite still
  // pushes to OOM, and a fractional count over-seeds a lane. Honest
  // stamps are epoch-ms, orders of magnitude inside the exact-integer
  // domain. Zero-advance result: the in-flight lanes are preserved
  // untouched (no completions, no respawns, no empty-lane seeding).
  if (
    // r21-COR-2: nowMs is a timestamp too - a finite but huge clock
    // (1e300) puts every due in the past and runs the same unbounded
    // settle loop the stamp pin closes.
    !Number.isFinite(nowMs) ||
    // r30-AUT-3: clocks live in [0, 2^52) - the persisted timestamp
    // domain. The +cycleMs headroom keeps every minted due inside it:
    // a clock within cycleMs of the bound would seed a due the next
    // save write self-refuses (wedge). A negative clock parks every
    // due anyway, so deny here for uniform seams.
    nowMs < 0 ||
    !(nowMs + Math.max(0, cycleMs) < 2 ** 52) ||
    !Number.isInteger(slots) || slots < 0 || slots > 65_536 ||
    (params.budgetMs !== undefined && !Number.isFinite(params.budgetMs)) ||
    // r31-COR-F-WIN-ASYM/F-HEADROOM: the window start is a persisted
    // clock AND the seed origin - it needs the same [0, 2^52) domain as
    // offlineSinceMs plus the +cycleMs headroom so seeded dues
    // (emptyLaneStartMs + cycleMs) stay inside the persisted bound.
    (params.emptyLaneStartMs !== undefined &&
      (!Number.isFinite(params.emptyLaneStartMs) ||
        params.emptyLaneStartMs < 0 ||
        !(params.emptyLaneStartMs + Math.max(0, cycleMs) < 2 ** 52))) ||
    // r31-COR-F-NEG-MINT: pending stamps live in [0, 2^52) - a negative
    // due is already-past and settles/mints on this call.
    params.pending.some(
      (cycle) =>
        !Number.isFinite(cycle.completesAtMs) ||
        !Number.isFinite(cycle.startedAtMs) ||
        cycle.completesAtMs <= cycle.startedAtMs ||
        cycle.completesAtMs < 0 ||
        cycle.completesAtMs >= 2 ** 52 ||
        cycle.startedAtMs < 0 ||
        cycle.startedAtMs >= 2 ** 52,
    )
  ) {
    return {
      completed: [],
      pending: [...params.pending],
      forfeited: 0,
      consumedBudgetMs: 0,
      seededPending: [],
    }
  }

  const canSpawn = cycleMs > 0 && baseSeconds > 0

  const hasBudget = params.budgetMs !== undefined

  let budgetLeftMs = Math.max(0, params.budgetMs ?? 0)

  // Lane cursors, sorted by deadline: every saved in-flight cycle keeps
  // its own lane, deadline and identity - including lanes beyond the
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
        seeded: true,
      })
    }

    lanes.sort((a, b) => a.dueMs - b.dueMs)
  }

  let inFlight = lanes.length

  const completed: ProductionCycle[] = []

  let forfeited = 0

  while (lanes.length > 0) {
    const lane = lanes[0]!

    // Lanes stay sorted by dueMs - once the earliest lane is in the
    // future, every remaining lane is in-flight work to keep.
    if (lane.dueMs > nowMs) {
      break
    }

    // r17-AUT-1 + r18-COR-2: once this due AND every successor can't be
    // paid, the rest of the chain forfeits anyway - jump it to its
    // post-window head in O(1) instead of walking one completion per
    // iteration. Successors always cost cycleMs, so the jump arms when
    // the head's cost exceeds the budget leftover AND cycleMs does too
    // (a leftover in (0, cycleMs) walks the same unbounded forfeits as
    // an exhausted one - the r17 guard's <= 0 missed that arm). A
    // crafted deep-past seed/deadline (e.g. lastSavedAt = 0 or a
    // completesAtMs far below the window) otherwise spins ~1e10 no-op
    // forfeits here on every boot - the same class DecomposeSystem
    // bounds with its settle cap. An affordable saved head (cost <=
    // budgetLeft) still completes first through the normal path; its
    // cycleMs-priced successor then jumps.
    const headCostMs = Math.max(0, lane.dueMs - lane.startMs)
    if (hasBudget && cycleMs > 0 && headCostMs > budgetLeftMs && cycleMs > budgetLeftMs) {
      const skippedDues = Math.floor((nowMs - lane.dueMs) / cycleMs) + 1
      const lastDueMs = lane.dueMs + (skippedDues - 1) * cycleMs

      lanes.shift()
      inFlight -= 1

      // Same slot rule as the per-iteration path: the chain continues
      // only while the lane still holds a slot (inFlight < slots);
      // oversubscribed lanes die with their forfeited dues. Forfeit
      // parity: the walk counts every due while the chain survives,
      // but only the head's forfeit before a dead lane ends.
      if (params.advanceMode === 'deadline' && canSpawn && inFlight < slots) {
        forfeited += skippedDues
        inFlight += 1
        lane.saved = undefined
        lane.startMs = lastDueMs
        lane.dueMs = lastDueMs + cycleMs

        let index = 0
        while (index < lanes.length && lanes[index]!.dueMs <= lane.dueMs) {
          index += 1
        }
        lanes.splice(index, 0, lane)
      } else {
        forfeited += 1
      }
      continue
    }

    lanes.shift()

    inFlight -= 1

    // A completion costs its own full duration (saved cycles use their
    // snapshot duration; spawned cycles always span exactly cycleMs).
    const costMs = headCostMs

    if (!hasBudget || costMs <= budgetLeftMs) {
      budgetLeftMs -= costMs

      completed.push(
        lane.saved ??
          buildProductionCycle(siteId, collectionRealmId, siteLevel, baseSeconds, lane.startMs, params.rng),
      )
    } else {
      forfeited += 1
    }

    if (params.advanceMode === 'deadline' && canSpawn && inFlight < slots) {
      // Continuous driver: the freed lane starts its next cycle at the
      // completion instant and keeps its slot.
      inFlight += 1

      const next: LaneCursor = {
        startMs: lane.dueMs,
        dueMs: lane.dueMs + cycleMs,
        seeded: lane.seeded,
      }

      let index = 0

      while (index < lanes.length && lanes[index]!.dueMs <= next.dueMs) {
        index += 1
      }

      lanes.splice(index, 0, next)
    }
    // 'observe': the freed lane ends here; the next tick refills it via
    // emptyLaneStartMs - identical to tickWorkers' top-up ordering.
  }

  const pending = lanes.map((lane) =>
    lane.saved ??
    buildProductionCycle(siteId, collectionRealmId, siteLevel, baseSeconds, lane.startMs, params.rng),
  )

  const seededPending = pending.filter(
    (_, index) => lanes[index]!.seeded === true,
  )

  return {
    completed,
    pending,
    seededPending,
    forfeited,
    consumedBudgetMs: hasBudget ? Math.max(0, params.budgetMs ?? 0) - budgetLeftMs : 0,
  }
}
