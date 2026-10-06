// ProductionOffline.test.ts - direct unit coverage for settleProductionOffline.
//
// Scope: edges the system-level suites do NOT isolate.
// ProductionSystem.test.ts covers the happy sequential path and the
// backlog forfeit through ProductionSystem.settleOffline;
// ProductionSystem.offlineParity.test.ts covers worker-lane parity with
// tickWorkers. This file drives the exported function with a stub
// ProductionOfflineDeps harness to pin:
//   - worker phase: capacity <= 0 / non-autoRestart freezes, fractional
//     capacity, missing offlineSinceMs seeding rule, cycleMs-0 sites,
//     the FULL-cap budget (no manual consumer ahead), and the shared
//     budget ordering across sites in states-map order.
//   - Mission D (spec D3): the manual activeCycle phase is deleted;
//     this file drives the worker phase only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { THANH_VAN_PRODUCTION_SITES } from './ProductionCatalog'
import {
  settleProductionOffline,
  type ProductionOfflineDeps,
  type ProductionOfflineOptions,
} from './ProductionOffline'
import { advanceWorkerLanes } from './WorkerLaneAdvance'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  PRODUCTION_OFFLINE_CAP_SECONDS,
  computeCycleSeconds,
} from './ProductionBalance'
import type {
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
} from './ProductionTypes'

const REALM = 'mortal'
const LAM = 'thanh_van_lam'
const QUANG = 'thanh_van_quang'
const CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM[REALM]!, 1) * 1000 // 100_000
const CAP_MS = PRODUCTION_OFFLINE_CAP_SECONDS * 1000
const T0 = 1_000_000

let cycleSeq = 0

function makeCycle(siteId: string, startedAtMs: number, completesAtMs: number): ProductionCycle {
  cycleSeq += 1

  return {
    cycleId: `test_cycle_${cycleSeq}`,
    siteId,
    collectionRealmId: REALM,
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: cycleSeq,
    startedAtMs,
    completesAtMs,
  }
}

function makeState(
  siteId: string,
  overrides: Partial<ProductionSiteState> = {},
): ProductionSiteState {
  return {
    siteId,
    level: 1,
    autoRestart: false,
    activeWorkerSlots: 0,
    workerCycles: [],
    ...overrides,
  }
}

interface Harness {
  deps: ProductionOfflineDeps
  /** Cycles handed to grantCycleRewards, in call order. */
  grants: ProductionCycle[]
}

/** Stub deps mirroring ProductionSystem semantics (worker lanes only). */
function createHarness(states: Map<string, ProductionSiteState>): Harness {
  const siteDefinitions = new Map<string, ProductionSiteDefinition>(
    THANH_VAN_PRODUCTION_SITES.map((site) => [site.siteId, site]),
  )

  const grants: ProductionCycle[] = []

  const deps: ProductionOfflineDeps = {
    states,
    getSiteDefinition: (siteId) => siteDefinitions.get(siteId),
    grantCycleRewards: (cycle) => {
      grants.push(cycle)
    },
  }

  return { deps, grants }
}

function settle(
  deps: ProductionOfflineDeps,
  nowMs: number,
  options: ProductionOfflineOptions = {},
): number {
  // bag/registry are pass-through arguments for grantCycleRewards; the
  // stub never reads them, so fresh empties suffice.
  return settleProductionOffline(deps, new MaterialBag(), new MaterialRegistry(), REALM, nowMs, options)
}

describe('settleProductionOffline — worker settle phase', () => {
  beforeEach(() => {
    // r16-INT-03: spawned lanes re-stamp into the field epoch
    // (+max(0, Date.now()-settleNowMs)). Pin the device clock at the
    // synthetic timeline origin so settled deadlines stay in the
    // frame these cases assert.
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // D1 (INV-D-03): a saved in-flight lane is retained work - it keeps
  // its own deadline and settles once under the cap budget even when
  // the pool is zero. Slots still zero out; no successor spawns.
  it('capacity <= 0 still settles a due saved lane once and zeroes activeWorkerSlots', () => {
    const saved = makeCycle(LAM, T0, T0 + CYCLE_MS)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, activeWorkerSlots: 3, workerCycles: [saved] })],
    ])
    const { deps, grants } = createHarness(states)

    expect(
      settle(deps, T0 + 150_000, { workerCapacity: -3, offlineSinceMs: T0 }),
    ).toBe(1)
    expect(grants).toEqual([saved])
    expect(states.get(LAM)!.workerCycles).toEqual([])
    expect(states.get(LAM)!.activeWorkerSlots).toBe(0)
  })

  // D1 (INV-D-03): leaving the auto set is an allocation drop to zero -
  // the retained lane still completes once, then the lane dies.
  it('settles a saved worker lane on a non-autoRestart site once, without respawning', () => {
    const saved = makeCycle(LAM, T0, T0 + CYCLE_MS)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: false, activeWorkerSlots: 2, workerCycles: [saved] })],
    ])
    const { deps, grants } = createHarness(states)

    expect(
      settle(deps, T0 + 150_000, { workerCapacity: 4, offlineSinceMs: T0 }),
    ).toBe(1)
    expect(grants).toEqual([saved])
    expect(states.get(LAM)!.workerCycles).toEqual([])
    expect(states.get(LAM)!.activeWorkerSlots).toBe(0)
  })

  it('treats fractional workerCapacity as its floor (1.9 -> a single lane chain)', () => {
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true })],
    ])
    const { deps } = createHarness(states)

    const now = T0 + 250_000
    const settled = settle(deps, now, {
      workerCapacity: 1.9,
      offlineSinceMs: T0,
      workerAssignments: new Map([[LAM, 2]]),
    })

    // Exactly one lane ran: completions at +100s and +200s only.
    expect(settled).toBe(2)
    expect(states.get(LAM)!.activeWorkerSlots).toBe(1)
    expect(states.get(LAM)!.workerCycles).toHaveLength(1)
    expect(states.get(LAM)!.workerCycles![0]!.completesAtMs).toBe(T0 + 300_000)
  })

  it('never seeds empty lanes without offlineSinceMs — only saved lanes keep chaining', () => {
    const saved = makeCycle(LAM, T0, T0 + CYCLE_MS)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, workerCycles: [saved] })],
    ])
    const { deps, grants } = createHarness(states)

    const now = T0 + 250_000
    const settled = settle(deps, now, {
      workerCapacity: 2,
      workerAssignments: new Map([[LAM, 2]]),
      // offlineSinceMs absent: the second (empty) lane has no window start.
    })

    // Saved lane completes at +100s and +200s; lane B never spawns.
    expect(settled).toBe(2)
    expect(grants).toHaveLength(2)
    expect(states.get(LAM)!.workerCycles).toHaveLength(1)
    expect(states.get(LAM)!.workerCycles![0]!.completesAtMs).toBe(T0 + 300_000)
  })

  it('drains a saved due lane once on sites with no definition (cycleMs 0 cannot spawn chains)', () => {
    const saved = makeCycle('ghost_site', T0, T0 + CYCLE_MS)
    const states = new Map<string, ProductionSiteState>([
      ['ghost_site', makeState('ghost_site', { autoRestart: true, workerCycles: [saved] })],
    ])
    const { deps, grants } = createHarness(states)

    const settled = settle(deps, T0 + 250_000, {
      workerCapacity: 1,
      offlineSinceMs: T0,
      workerAssignments: new Map([['ghost_site', 1]]),
    })

    expect(settled).toBe(1)
    expect(grants).toEqual([saved])
    expect(states.get('ghost_site')!.workerCycles).toEqual([])
  })

  it('worker phase now receives the FULL cap budget (no manual consumer ahead of it)', () => {
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, workerCycles: [] })],
    ])
    const { deps, grants } = createHarness(states)

    // Window = exactly the cap: floor(CAP_MS / CYCLE_MS) completions all
    // paid - previously a manual cycle could consume budget first.
    const settled = settle(deps, T0 + CAP_MS, {
      workerCapacity: 1,
      offlineSinceMs: T0,
      workerAssignments: new Map([[LAM, 1]]),
    })

    expect(settled).toBe(Math.floor(CAP_MS / CYCLE_MS))
    expect(grants).toHaveLength(settled)
  })

  it('feeds the remaining worker budget to sites in states order — an earlier site can starve later ones', () => {
    // r31-NEG-MINT: persisted stamps live in [0, 2^52) - the CAP_MS
    // span that starves the later site must sit at the domain edge to
    // stay admitted (a negative start now denies verbatim).
    const BOUND = 2 ** 52
    const now = BOUND - 150_000
    const options: ProductionOfflineOptions = {
      workerCapacity: 2,
      offlineSinceMs: T0,
      workerAssignments: new Map([
        [LAM, 1],
        [QUANG, 1],
      ]),
    }

    // LAM first: its saved lane eats the whole cap; QUANG's lane forfeits.
    const expensive = makeCycle(LAM, BOUND - 200_000 - CAP_MS, BOUND - 200_000) // duration CAP_MS
    const cheap = makeCycle(QUANG, BOUND - 250_000, BOUND - 150_000)
    const lamFirst = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, workerCycles: [expensive] })],
      [QUANG, makeState(QUANG, { autoRestart: true, workerCycles: [cheap] })],
    ])
    const harnessA = createHarness(lamFirst)

    expect(settle(harnessA.deps, now, options)).toBe(1)
    expect(harnessA.grants).toEqual([expensive])
    // QUANG's saved lane was dropped unpaid; only a live tail remains.
    expect(lamFirst.get(QUANG)!.workerCycles!.map((cycle) => cycle.completesAtMs)).toEqual([
      BOUND - 50_000,
    ])

    // QUANG first: the cheap lane fits; the expensive lane no longer does.
    const quangFirst = new Map<string, ProductionSiteState>([
      [
        QUANG,
        makeState(QUANG, {
          autoRestart: true,
          workerCycles: [makeCycle(QUANG, BOUND - 250_000, BOUND - 150_000)],
        }),
      ],
      [
        LAM,
        makeState(LAM, {
          autoRestart: true,
          workerCycles: [makeCycle(LAM, BOUND - 200_000 - CAP_MS, BOUND - 200_000)],
        }),
      ],
    ])
    const harnessB = createHarness(quangFirst)

    expect(settle(harnessB.deps, now, options)).toBe(1)
    expect(harnessB.grants).toHaveLength(1)
    expect(harnessB.grants[0]!.siteId).toBe(QUANG)
  })
})

describe('settleProductionOffline — spawned-lane epoch shift (r16-INT-03 / r17-INT-01 / r18-COR-4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // r17-INT-01(a): the successor of a SAVED lane inherits the saved
  // lane's client-epoch deadline - its chain is not seed-rooted and
  // must not be shifted even when the window is server-anchored.
  it('keeps a saved-lane successor deadline unshifted under a server-anchored window', () => {
    // Window [T0+100k, T0+300k] server-anchored; device clock runs
    // +200k ahead of settleNowMs (the skew that used to shift stamps).
    vi.spyOn(Date, 'now').mockReturnValue(T0 + 500_000)
    const saved = makeCycle(LAM, T0, T0 + 100_000)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, activeWorkerSlots: 1, workerCycles: [saved] })],
    ])
    const { deps, grants } = createHarness(states)

    const settled = settle(deps, T0 + 300_000, {
      workerCapacity: 1,
      offlineSinceMs: T0 + 100_000,
    })

    // saved lane chain completes at T0+100k/200k/300k; the pending
    // successor keeps its client-epoch deadline T0+400k.
    expect(settled).toBe(3)
    expect(grants).toHaveLength(3)
    expect(states.get(LAM)!.workerCycles!.map((cycle) => cycle.completesAtMs)).toEqual([
      T0 + 400_000,
    ])
    expect(states.get(LAM)!.workerCycles!.map((cycle) => cycle.startedAtMs)).toEqual([
      T0 + 300_000,
    ])
  })

  // r18-COR-4: a seed-rooted chain's pending head encodes "remaining
  // work at settle" relative to nowMs regardless of the seed's anchor
  // epoch - client-anchored windows re-stamp it the same +200k (a raw
  // T0+400k stamp would pay ~1 cycle early at the field's T0+500k).
  it('re-stamps client-anchored seeded lanes the same - the head is settle-relative', () => {
    // Save was written on a client clock; restore sees field-now
    // T0+500k while the settle window ended at T0+300k.
    vi.spyOn(Date, 'now').mockReturnValue(T0 + 500_000)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, activeWorkerSlots: 2, workerCycles: [] })],
    ])
    const { deps } = createHarness(states)

    const settled = settle(deps, T0 + 300_000, {
      workerCapacity: 2,
      offlineSinceMs: T0,
    })

    // Two lanes seeded at T0 complete at 100k/200k/300k each; pending
    // heads owe (T0+400k - T0+300k) = 100k of remaining work at settle
    // -> field-epoch deadline T0+500k + 100k = T0+600k.
    expect(settled).toBe(6)
    expect(states.get(LAM)!.workerCycles!.map((cycle) => cycle.completesAtMs)).toEqual([
      T0 + 600_000,
      T0 + 600_000,
    ])
  })

  // r16-INT-03 stays pinned: lanes seeded at a SERVER-anchored window
  // DO carry the settle epoch and still get the one-way shift.
  it('still re-stamps server-seeded pending lanes into the field epoch', () => {
    vi.spyOn(Date, 'now').mockReturnValue(T0 + 500_000)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, activeWorkerSlots: 1, workerCycles: [] })],
    ])
    const { deps } = createHarness(states)

    const settled = settle(deps, T0 + 300_000, {
      workerCapacity: 1,
      offlineSinceMs: T0 + 100_000,
    })

    // Seed at T0+100k (server): dues 200k/300k complete, pending
    // T0+400k shifted +200k -> T0+600k in the field epoch.
    expect(settled).toBe(2)
    expect(states.get(LAM)!.workerCycles!.map((cycle) => cycle.completesAtMs)).toEqual([
      T0 + 600_000,
    ])
  })
})

describe('settleProductionOffline — settle-loop depth bound (r17-AUT-1)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // r17-AUT-1: a crafted deep-past seed used to walk the chain one
  // completion per cycle across the whole window depth. With the
  // budget spent the chain jumps to its post-window head in O(1) -
  // the settle pays at most CAP/cycleMs completions per lane.
  it('bounds a deep-past seed chain by the offline cap instead of window depth', () => {
    // r18-COR-4: pin field-now so the seed-rooted head's re-stamp is
    // deterministic (it owes 1.1M of remaining work past the settle).
    vi.spyOn(Date, 'now').mockReturnValue(T0 + 50_000_000)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, activeWorkerSlots: 1, workerCycles: [] })],
    ])
    const { deps, grants } = createHarness(states)

    // Deep-past seed (crafted lastSavedAt = 0 shape): 411 dues fall
    // inside [0, nowMs] at 100s cycles, the cap pays only 36_000_000ms
    // of cycle time -> 360 completions, the rest forfeit in O(1).
    const now = T0 + 40_000_000
    const settled = settle(deps, now, {
      workerCapacity: 1,
      offlineSinceMs: 0,
    })

    expect(settled).toBe(360)
    expect(grants).toHaveLength(360)
    // The pending head is the first due past nowMs; seed-rooted, so it
    // re-stamps to the field epoch: Date.now + (41.1M - 40M) = 51.1M.
    expect(states.get(LAM)!.workerCycles!.map((cycle) => cycle.completesAtMs)).toEqual([
      51_100_000,
    ])
    expect(states.get(LAM)!.workerCycles!.map((cycle) => cycle.startedAtMs)).toEqual([
      51_000_000,
    ])
  })

  // r17-AUT-1 sibling: a saved lane with a deep-past deadline - the
  // first head pays/forfeits by cost, then the successor chain jumps
  // the same way once the budget is spent.
  it('bounds a deep-past saved lane chain the same way', () => {
    vi.spyOn(Date, 'now').mockReturnValue(T0 + 50_000_000)
    const saved = makeCycle(LAM, 0, 100_000)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, activeWorkerSlots: 1, workerCycles: [saved] })],
    ])
    const { deps } = createHarness(states)

    const now = T0 + 40_000_000
    const settled = settle(deps, now, {
      workerCapacity: 1,
      offlineSinceMs: 0,
    })

    // dues 100k..41_000k: 410 in-window dues pay until the 36M budget
    // is gone (360 completions), the 50-due tail jumps to its head.
    expect(settled).toBe(360)
    // Saved-rooted chain: the head is the lane's own deadline and
    // keeps its stamp (r18-COR-4 residual - an ancient saved-chain
    // head pays ~1 cycle early at the next tick, bounded one-time).
    expect(states.get(LAM)!.workerCycles!.map((cycle) => cycle.completesAtMs)).toEqual([
      41_100_000,
    ])
  })
})

describe('advanceWorkerLanes — defensive input guard (r19/r20-AUT/COR hardening)', () => {
  const baseParams = {
    siteId: LAM,
    collectionRealmId: REALM,
    siteLevel: 1,
    baseSeconds: 100,
    cycleMs: 100_000,
    slots: 1,
    nowMs: T0 + 300_000,
    advanceMode: 'deadline' as const,
    budgetMs: 36_000_000,
  }

  // A NaN due never breaks the settle loop (NaN > nowMs is always
  // false) and respawns NaN forever - the guard returns the in-flight
  // lanes untouched instead of hanging deadline mode.
  it('returns zero-advance when emptyLaneStartMs is NaN', () => {
    const result = advanceWorkerLanes({
      ...baseParams,
      pending: [],
      emptyLaneStartMs: Number.NaN,
    })

    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(0)
    expect(result.seededPending).toHaveLength(0)
    expect(result.forfeited).toBe(0)
    expect(result.consumedBudgetMs).toBe(0)
  })

  it('returns zero-advance when a pending due is non-finite', () => {
    const saved = { ...makeCycle(LAM, Number.NaN, Number.NaN) }
    const result = advanceWorkerLanes({
      ...baseParams,
      pending: [saved],
      emptyLaneStartMs: T0,
    })

    expect(result.completed).toHaveLength(0)
    expect(result.pending).toEqual([saved])
    expect(result.forfeited).toBe(0)
    expect(result.consumedBudgetMs).toBe(0)
  })

  // r20-AUT: a reversed/zero span computes headCost = 0 and would grant
  // a free completion per entry - the validator's F-A11-4 ordering pin
  // rejects the shape upstream; the mechanism guard mirrors it.
  it('returns zero-advance when a pending span is reversed or zero', () => {
    const reversed = { ...makeCycle(LAM, T0 + 100_000, T0) }
    const zeroSpan = { ...makeCycle(LAM, T0, T0) }

    for (const saved of [reversed, zeroSpan]) {
      const result = advanceWorkerLanes({
        ...baseParams,
        pending: [saved],
        emptyLaneStartMs: T0,
      })

      expect(result.completed).toHaveLength(0)
      expect(result.pending).toEqual([saved])
      expect(result.forfeited).toBe(0)
      expect(result.consumedBudgetMs).toBe(0)
    }
  })

  // r21-COR-2: nowMs is a timestamp too - a finite but huge clock
  // puts every due in the past and runs the same unbounded settle
  // loop the stamp pins close.
  it('returns zero-advance when nowMs exceeds the exact-integer domain', () => {
    const saved = { ...makeCycle(LAM, T0, T0 + 100_000) }

    for (const nowMs of [2 ** 53, 1e300]) {
      const result = advanceWorkerLanes({
        ...baseParams,
        nowMs,
        pending: [saved],
        emptyLaneStartMs: T0,
      })

      expect(result.completed).toHaveLength(0)
      expect(result.pending).toEqual([saved])
      expect(result.consumedBudgetMs).toBe(0)
    }
  })

  // r20-COR-1: at |stamp| >= 2^53 float64 absorbs stamp + cycleMs back
  // into stamp - headCost = 0 forever, dues never reach nowMs, an
  // unbounded settle loop. A crafted deep-past lastSavedAt used to
  // reach this through the window start; the r21 validator magnitude
  // pin rejects it at admission, this arm keeps mechanism-level cover.
  it('returns zero-advance when emptyLaneStartMs exceeds the exact-integer domain', () => {
    const saved = { ...makeCycle(LAM, T0, T0 + 100_000) }

    for (const start of [-1e308, -(2 ** 53), 2 ** 53, 1e308]) {
      const result = advanceWorkerLanes({
        ...baseParams,
        pending: [saved],
        emptyLaneStartMs: start,
      })

      expect(result.completed).toHaveLength(0)
      expect(result.pending).toEqual([saved])
      expect(result.seededPending).toHaveLength(0)
      expect(result.consumedBudgetMs).toBe(0)
    }
  })

  it('returns zero-advance when a pending stamp exceeds the exact-integer domain', () => {
    const deepDue = { ...makeCycle(LAM, -(2 ** 53) - 200_000, -(2 ** 53) - 100_000) }
    const deepStart = { ...makeCycle(LAM, 1e21, 1e21 + 100_000) }

    for (const saved of [deepDue, deepStart]) {
      const result = advanceWorkerLanes({
        ...baseParams,
        pending: [saved],
        emptyLaneStartMs: T0,
      })

      expect(result.completed).toHaveLength(0)
      expect(result.pending).toEqual([saved])
      expect(result.consumedBudgetMs).toBe(0)
    }
  })

  // r20-COR-2 + r21-INT-01: non-finite or out-of-contract slots makes
  // the seed loop push lanes without bound (1e9 finite still OOMs; a
  // fractional count over-seeds a lane). 0 stays legal - lanes settle
  // their dues and just never respawn.
  it('returns zero-advance when slots is outside the bounded-integer contract', () => {
    const saved = { ...makeCycle(LAM, T0, T0 + 100_000) }

    for (const slots of [Number.POSITIVE_INFINITY, Number.NaN, 1e9, 1.5, -1, 65_537]) {
      const result = advanceWorkerLanes({
        ...baseParams,
        slots,
        pending: [saved],
        emptyLaneStartMs: T0,
      })

      expect(result.completed).toHaveLength(0)
      expect(result.pending).toEqual([saved])
      expect(result.consumedBudgetMs).toBe(0)
    }
  })

  it('settles normally at the slots boundary (0 and 65536 legal)', () => {
    const saved = { ...makeCycle(LAM, T0, T0 + 100_000) }

    const zeroSlots = advanceWorkerLanes({
      ...baseParams,
      slots: 0,
      pending: [saved],
      emptyLaneStartMs: T0,
    })
    expect(zeroSlots.completed).toHaveLength(1)
    expect(zeroSlots.pending).toHaveLength(0)

    // 65536 must stay legal: with no emptyLaneStartMs the seed loop is
    // skipped, so the boundary contract check runs without the push.
    const maxSlots = advanceWorkerLanes({
      ...baseParams,
      slots: 65_536,
      pending: [saved],
    })
    expect(maxSlots.completed.length).toBeGreaterThan(0)
  })
})
