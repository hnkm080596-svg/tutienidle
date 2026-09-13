// M11 (ARCH-007) — per-lane offline worker settlement parity.
// Oracle: audit AUD-E01 (docs/qa/2026-09-14-audit-economy-review.md).
// Invariant: each worker lane completes on ITS OWN deadline; partial
// work across lanes never synthesizes a completed cycle; identical
// saved state + elapsed yields identical completed-cycle counts online
// vs offline within PRODUCTION_OFFLINE_CAP; retained future cycles keep
// their reserved lane capacity and original deadlines.
import { describe, expect, it } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { materials } from '../../data/materials/materials'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_GROTTO_HERBS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_PRODUCTION_SITES,
} from './ProductionCatalog'
import { ProductionSystem } from './ProductionSystem'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  PRODUCTION_OFFLINE_CAP_SECONDS,
  computeCycleSeconds,
} from './ProductionBalance'
import type { ProductionCycle, ProductionSiteState } from './ProductionTypes'

const REALM = 'mortal'
const SITE = 'thanh_van_lam'
const CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM[REALM]!, 1) * 1000 // 100_000

function createSystem(): ProductionSystem {
  return new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
  })
}

function createBag(): { bag: MaterialBag; registry: MaterialRegistry } {
  const registry = new MaterialRegistry()
  for (const material of materials) {
    registry.register(material)
  }
  return { bag: new MaterialBag(), registry }
}

function makeWorkerCycle(siteId: string, startMs: number, completesAtMs: number, id: string): ProductionCycle {
  return {
    cycleId: id,
    siteId,
    collectionRealmId: REALM,
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 12345,
    startedAtMs: startMs,
    completesAtMs,
  }
}

function siteState(workerCycles: ProductionCycle[]): ProductionSiteState[] {
  return [
    {
      siteId: SITE,
      level: 1,
      autoRestart: true,
      activeWorkerSlots: 0,
      workerCycles,
    },
  ]
}

function pendingDues(system: ProductionSystem, siteId = SITE): number[] {
  return (system.getState(siteId)!.workerCycles ?? [])
    .map((cycle) => cycle.completesAtMs)
    .sort((a, b) => a - b)
}

describe('M11 / ARCH-007 — per-lane offline worker settlement', () => {
  it('AUD-E01 oracle: 2 workers due T+100s, settle at T+65s -> 0 granted, both pending kept', () => {
    const { bag, registry } = createBag()
    const start = 1_000_000
    const now = start + 65_000
    const assignments = new Map([[SITE, 2]])

    // Online reference: tick at start creates both lanes, tick at +65s grants nothing.
    const online = createSystem()
    const onlineBag = createBag()
    online.restoreStates(siteState([]))
    online.tickWorkers(start, onlineBag.bag, onlineBag.registry, REALM, 2, assignments)
    const saved = structuredClone(online.getAllStates())
    online.tickWorkers(now, onlineBag.bag, onlineBag.registry, REALM, 2, assignments)
    expect(online.drainSettlementEvents()).toEqual([])

    // Offline path from the same saved state must grant the same count: 0.
    const offline = createSystem()
    offline.restoreStates(saved)
    const settled = offline.settleOffline(bag, registry, REALM, now, {
      workerCapacity: 2,
      offlineSinceMs: start,
      workerAssignments: assignments,
    })

    expect(settled).toBe(0)
    expect(offline.drainSettlementEvents()).toEqual([])
    // Both pending lanes kept with their ORIGINAL deadlines.
    expect(pendingDues(offline)).toEqual([start + CYCLE_MS, start + CYCLE_MS])
  })

  it('partial window: each lane settles only its own completed cycles, tails keep new deadlines', () => {
    const { bag, registry } = createBag()
    const start = 1_000_000
    const now = start + 160_000

    const system = createSystem()
    system.restoreStates(
      siteState([
        makeWorkerCycle(SITE, start, start + 100_000, 'lane_a'),
        makeWorkerCycle(SITE, start + 50_000, start + 150_000, 'lane_b'),
      ]),
    )

    const settled = system.settleOffline(bag, registry, REALM, now, {
      workerCapacity: 2,
      offlineSinceMs: start,
      workerAssignments: new Map([[SITE, 2]]),
    })

    // Both saved lanes completed inside the window — exactly once each.
    expect(settled).toBe(2)
    expect(system.drainSettlementEvents()).toHaveLength(2)

    // Each freed lane keeps working: in-flight successors start at their
    // own completion instants (deadline chaining), not pooled.
    expect(pendingDues(system)).toEqual([start + 200_000, start + 250_000])
    const starts = (system.getState(SITE)!.workerCycles ?? [])
      .map((cycle) => cycle.startedAtMs)
      .sort((a, b) => a - b)
    expect(starts).toEqual([start + 100_000, start + 150_000])
  })

  it('retained lanes beyond current slots keep capacity and are not refilled or double-granted', () => {
    const { bag, registry } = createBag()
    const start = 1_000_000
    const now = start + 105_000

    // 3 saved in-flight lanes but capacity now assigns only 1 slot.
    const system = createSystem()
    system.restoreStates(
      siteState([
        makeWorkerCycle(SITE, start, start + 100_000, 'lane_a'),
        makeWorkerCycle(SITE, start + 10_000, start + 110_000, 'lane_b'),
        makeWorkerCycle(SITE, start + 20_000, start + 120_000, 'lane_c'),
      ]),
    )

    const settled = system.settleOffline(bag, registry, REALM, now, {
      workerCapacity: 1,
      offlineSinceMs: start,
      workerAssignments: new Map([[SITE, 1]]),
    })

    // Lane A completes; lanes B/C retained untouched (no synthesized grant,
    // no respawn while in-flight work still exceeds the slot budget).
    expect(settled).toBe(1)
    expect(pendingDues(system)).toEqual([start + 110_000, start + 120_000])
  })

  it('shared work-budget cap binds across lanes; no past-due pending left behind', () => {
    const { bag, registry } = createBag()
    const start = 1_000_000
    const now = start + 100 * 3600_000 // 100h >> 10h cap

    const system = createSystem()
    system.restoreStates(siteState([]))

    const settled = system.settleOffline(bag, registry, REALM, now, {
      workerCapacity: 2,
      offlineSinceMs: start,
      workerAssignments: new Map([[SITE, 2]]),
    })

    // Cap is total rewarded worker-cycle seconds: 2 lanes share one budget.
    expect(settled).toBeLessThanOrEqual(Math.floor((PRODUCTION_OFFLINE_CAP_SECONDS * 1000) / CYCLE_MS))
    expect(settled).toBeGreaterThan(0)

    // Every retained pending cycle is genuinely in-flight (due in the
    // future) — nothing past-due lingers for a free online grant, and
    // both lanes keep a live chain tail (capacity stays reserved).
    expect(pendingDues(system)).toHaveLength(2)
    for (const due of pendingDues(system)) {
      expect(due).toBeGreaterThan(now)
    }
  })

  it('repeated save/settle cycles converge with continuous production', () => {
    const { bag, registry } = createBag()
    const start = 1_000_000
    const assignments = new Map([[SITE, 2]])

    // First absence: T -> T+65s — nothing due, both lanes retained.
    const first = createSystem()
    first.restoreStates(
      siteState([
        makeWorkerCycle(SITE, start, start + 100_000, 'lane_a'),
        makeWorkerCycle(SITE, start, start + 100_000, 'lane_b'),
      ]),
    )
    const settledFirst = first.settleOffline(bag, registry, REALM, start + 65_000, {
      workerCapacity: 2,
      offlineSinceMs: start,
      workerAssignments: assignments,
    })
    expect(settledFirst).toBe(0)

    // Save again (detached snapshot) and restore into a fresh system —
    // the second absence T+65s -> T+165s must settle each lane once.
    const savedAgain = structuredClone(first.getAllStates())
    const keptIds = (savedAgain[0]!.workerCycles ?? []).map((cycle) => cycle.cycleId).sort()
    expect(keptIds).toEqual(['lane_a', 'lane_b'])

    const second = createSystem()
    second.restoreStates(savedAgain)
    const settledSecond = second.settleOffline(bag, registry, REALM, start + 165_000, {
      workerCapacity: 2,
      offlineSinceMs: start + 65_000,
      workerAssignments: assignments,
    })
    expect(settledSecond).toBe(2)
    expect(pendingDues(second)).toEqual([start + 200_000, start + 200_000])

    // Third absence settles the chains once more — total granted equals
    // 2 lanes x 2 completions (at +100s and +200s), no pooling residue.
    const third = createSystem()
    third.restoreStates(structuredClone(second.getAllStates()))
    const settledThird = third.settleOffline(bag, registry, REALM, start + 265_000, {
      workerCapacity: 2,
      offlineSinceMs: start + 165_000,
      workerAssignments: assignments,
    })
    expect(settledThird).toBe(2)
    expect(settledFirst + settledSecond + settledThird).toBe(4)
  })

  it('kept future cycles are not re-granted by a repeated settle or the online tick', () => {
    const { bag, registry } = createBag()
    const start = 1_000_000
    const assignments = new Map([[SITE, 2]])

    const system = createSystem()
    system.restoreStates(
      siteState([
        makeWorkerCycle(SITE, start, start + 100_000, 'lane_a'),
        makeWorkerCycle(SITE, start, start + 100_000, 'lane_b'),
      ]),
    )

    const settledFirst = system.settleOffline(bag, registry, REALM, start + 65_000, {
      workerCapacity: 2,
      offlineSinceMs: start,
      workerAssignments: assignments,
    })
    expect(settledFirst).toBe(0)
    system.drainSettlementEvents()

    // Re-settling the same window is a no-op for already-kept lanes.
    const settledAgain = system.settleOffline(bag, registry, REALM, start + 65_000, {
      workerCapacity: 2,
      offlineSinceMs: start,
      workerAssignments: assignments,
    })
    expect(settledAgain).toBe(0)
    expect(pendingDues(system)).toEqual([start + 100_000, start + 100_000])

    // The online tick grants each kept cycle exactly once at its deadline;
    // the freed lanes drain now and refill on the NEXT tick (top-up-then-
    // settle order — identical to the pre-M11 online semantics).
    system.tickWorkers(start + 101_000, bag, registry, REALM, 2, assignments)
    expect(system.drainSettlementEvents()).toHaveLength(2)
    expect(pendingDues(system)).toEqual([])

    system.tickWorkers(start + 101_000, bag, registry, REALM, 2, assignments)
    expect(system.drainSettlementEvents()).toEqual([])
    expect(pendingDues(system)).toEqual([start + 101_000 + CYCLE_MS, start + 101_000 + CYCLE_MS])
  })

  it('online tick and offline settle produce identical completed counts and pending deadlines', () => {
    const start = 1_000_000
    const now = start + 650_000 // 6.5 cycles per lane
    const assignments = new Map([[SITE, 2]])

    // Saved state: both lanes already in flight, due T+100s.
    const saved = siteState([
      makeWorkerCycle(SITE, start, start + 100_000, 'lane_a'),
      makeWorkerCycle(SITE, start, start + 100_000, 'lane_b'),
    ])

    // Online driver: observe at every completion instant (the dense limit
    // of the per-tick loop — refill happens at the same instant).
    const online = createSystem()
    const onlineBag = createBag()
    online.restoreStates(structuredClone(saved))
    let onlineCompleted = 0
    const onlineDrive = (t: number) => {
      online.tickWorkers(t, onlineBag.bag, onlineBag.registry, REALM, 2, assignments)
      onlineCompleted += online.drainSettlementEvents().length
    }
    for (;;) {
      const dues = pendingDues(online)
      const nextDue = dues.length > 0 ? dues[0]! : Number.POSITIVE_INFINITY
      if (nextDue > now) {
        break
      }
      onlineDrive(nextDue) // settle completions at their instant
      onlineDrive(nextDue) // refill freed lanes at the same instant
    }
    onlineDrive(now)

    const offline = createSystem()
    const offlineBag = createBag()
    offline.restoreStates(structuredClone(saved))
    const settled = offline.settleOffline(offlineBag.bag, offlineBag.registry, REALM, now, {
      workerCapacity: 2,
      offlineSinceMs: start,
      workerAssignments: assignments,
    })

    // 6 completions per lane (at +100s..+600s), identical online/offline.
    expect(onlineCompleted).toBe(12)
    expect(settled).toBe(12)
    expect(settled).toBe(onlineCompleted)
    // Same in-flight state: both lanes mid-cycle with identical deadlines.
    expect(pendingDues(offline)).toEqual(pendingDues(online))
    expect(pendingDues(offline)).toEqual([start + 700_000, start + 700_000])
  })

  it('empty lanes produce during the window only from the save instant onward', () => {
    const { bag, registry } = createBag()
    const start = 1_000_000
    const now = start + 250_000

    // One lane in flight (due T+100s), second lane empty at save time.
    const system = createSystem()
    system.restoreStates(siteState([makeWorkerCycle(SITE, start, start + 100_000, 'lane_a')]))

    const settled = system.settleOffline(bag, registry, REALM, now, {
      workerCapacity: 2,
      offlineSinceMs: start,
      workerAssignments: new Map([[SITE, 2]]),
    })

    // Lane A: completes at +100s, +200s (2). Lane B (empty at save):
    // starts at T, completes at +100s, +200s (2). Total 4, each lane
    // advanced independently — no pooling of partial work.
    expect(settled).toBe(4)
    expect(pendingDues(system)).toEqual([start + 300_000, start + 300_000])
  })
})
