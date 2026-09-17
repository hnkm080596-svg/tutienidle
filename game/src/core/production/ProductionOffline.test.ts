// ProductionOffline.test.ts — direct unit coverage for settleProductionOffline.
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
import { describe, expect, it } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { THANH_VAN_PRODUCTION_SITES } from './ProductionCatalog'
import {
  settleProductionOffline,
  type ProductionOfflineDeps,
  type ProductionOfflineOptions,
} from './ProductionOffline'
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
  it('capacity <= 0 freezes saved lanes but still zeroes activeWorkerSlots on every state', () => {
    const saved = makeCycle(LAM, T0, T0 + CYCLE_MS)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, activeWorkerSlots: 3, workerCycles: [saved] })],
    ])
    const { deps, grants } = createHarness(states)

    expect(
      settle(deps, T0 + 150_000, { workerCapacity: -3, offlineSinceMs: T0 }),
    ).toBe(0)
    expect(grants).toEqual([])
    // In-flight lanes stay frozen for when capacity returns...
    expect(states.get(LAM)!.workerCycles).toEqual([saved])
    // ...but stale slot counts are always re-zeroed first.
    expect(states.get(LAM)!.activeWorkerSlots).toBe(0)
  })

  it('freezes saved worker lanes on non-autoRestart sites (not advanced, not forfeited)', () => {
    const saved = makeCycle(LAM, T0, T0 + CYCLE_MS)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: false, activeWorkerSlots: 2, workerCycles: [saved] })],
    ])
    const { deps, grants } = createHarness(states)

    expect(
      settle(deps, T0 + 150_000, { workerCapacity: 4, offlineSinceMs: T0 }),
    ).toBe(0)
    expect(grants).toEqual([])
    expect(states.get(LAM)!.workerCycles).toEqual([saved])
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
    // paid — previously a manual cycle could consume budget first.
    const settled = settle(deps, T0 + CAP_MS, {
      workerCapacity: 1,
      offlineSinceMs: T0,
      workerAssignments: new Map([[LAM, 1]]),
    })

    expect(settled).toBe(Math.floor(CAP_MS / CYCLE_MS))
    expect(grants).toHaveLength(settled)
  })

  it('feeds the remaining worker budget to sites in states order — an earlier site can starve later ones', () => {
    const now = T0 + 140_000
    const options: ProductionOfflineOptions = {
      workerCapacity: 2,
      offlineSinceMs: T0,
      workerAssignments: new Map([
        [LAM, 1],
        [QUANG, 1],
      ]),
    }

    // LAM first: its saved lane eats the whole cap; QUANG's lane forfeits.
    const expensive = makeCycle(LAM, T0 + 50_000 - CAP_MS, T0 + 50_000) // duration CAP_MS
    const cheap = makeCycle(QUANG, T0, T0 + CYCLE_MS)
    const lamFirst = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, workerCycles: [expensive] })],
      [QUANG, makeState(QUANG, { autoRestart: true, workerCycles: [cheap] })],
    ])
    const harnessA = createHarness(lamFirst)

    expect(settle(harnessA.deps, now, options)).toBe(1)
    expect(harnessA.grants).toEqual([expensive])
    // QUANG's saved lane was dropped unpaid; only a live tail remains.
    expect(lamFirst.get(QUANG)!.workerCycles!.map((cycle) => cycle.completesAtMs)).toEqual([
      T0 + 200_000,
    ])

    // QUANG first: the cheap lane fits; the expensive lane no longer does.
    const quangFirst = new Map<string, ProductionSiteState>([
      [
        QUANG,
        makeState(QUANG, { autoRestart: true, workerCycles: [makeCycle(QUANG, T0, T0 + CYCLE_MS)] }),
      ],
      [
        LAM,
        makeState(LAM, {
          autoRestart: true,
          workerCycles: [makeCycle(LAM, T0 + 50_000 - CAP_MS, T0 + 50_000)],
        }),
      ],
    ])
    const harnessB = createHarness(quangFirst)

    expect(settle(harnessB.deps, now, options)).toBe(1)
    expect(harnessB.grants).toHaveLength(1)
    expect(harnessB.grants[0]!.siteId).toBe(QUANG)
  })
})
