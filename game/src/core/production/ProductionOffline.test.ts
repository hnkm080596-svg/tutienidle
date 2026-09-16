// ProductionOffline.test.ts — direct unit coverage for settleProductionOffline.
//
// Scope: edges the system-level suites do NOT isolate.
// ProductionSystem.test.ts covers the happy sequential path and the
// backlog forfeit through ProductionSystem.settleOffline;
// ProductionSystem.offlineParity.test.ts covers worker-lane parity with
// tickWorkers. This file drives the exported function with a stub
// ProductionOfflineDeps harness to pin:
//   - manual phase: empty queue, not-yet-due / boundary deadlines,
//     canStart gate, per-cycle budget cost (negative-duration clamp,
//     oversized-cycle forfeit), GLOBAL earliest-deadline ordering across
//     sites, the 5000-iteration loop guard.
//   - worker phase: capacity <= 0 / non-autoRestart freezes, fractional
//     capacity, missing offlineSinceMs seeding rule, cycleMs-0 sites,
//     and the SHARED budget handoff (manual first, then worker sites in
//     states-map order).
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
  /** startCycle invocations, in call order. */
  starts: Array<{ siteId: string; collectionRealmId: string; nowMs: number }>
}

/**
 * Stub deps mirroring ProductionSystem semantics: canStart = no active
 * cycle; startCycle writes a fixed-duration cycle (restartCycleMs)
 * unless the slot is taken; grantCycleRewards only records the cycle.
 */
function createHarness(
  states: Map<string, ProductionSiteState>,
  options: {
    canStart?: (siteId: string) => boolean
    restartCycleMs?: number
  } = {},
): Harness {
  const siteDefinitions = new Map<string, ProductionSiteDefinition>(
    THANH_VAN_PRODUCTION_SITES.map((site) => [site.siteId, site]),
  )

  const grants: ProductionCycle[] = []
  const starts: Harness['starts'] = []

  const deps: ProductionOfflineDeps = {
    states,
    getSiteDefinition: (siteId) => siteDefinitions.get(siteId),
    canStart: options.canStart ?? ((siteId) => states.get(siteId)?.activeCycle === undefined),
    startCycle: (siteId, collectionRealmId, nowMs) => {
      starts.push({ siteId, collectionRealmId, nowMs })

      const state = states.get(siteId)

      if (!state || state.activeCycle) {
        return false
      }

      state.activeCycle = makeCycle(siteId, nowMs, nowMs + (options.restartCycleMs ?? CYCLE_MS))

      return true
    },
    grantCycleRewards: (cycle) => {
      grants.push(cycle)
    },
  }

  return { deps, grants, starts }
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

describe('settleProductionOffline — manual cycle phase', () => {
  it('returns 0 for an empty state map (nothing due, nothing to forfeit)', () => {
    const states = new Map<string, ProductionSiteState>()
    const { deps, grants, starts } = createHarness(states)

    expect(
      settle(deps, T0, { workerCapacity: 2, offlineSinceMs: 0 }),
    ).toBe(0)
    expect(grants).toEqual([])
    expect(starts).toEqual([])
  })

  it('leaves in-flight cycles untouched when nowMs precedes their deadline (zero/negative elapsed)', () => {
    const notDue = makeCycle(LAM, T0 - 10_000, T0 + 50_000)
    // Corrupted snapshot: even the START is after nowMs.
    const negativeElapsed = makeCycle(QUANG, T0 + 10_000, T0 + 60_000)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { activeCycle: notDue, autoRestart: true })],
      [QUANG, makeState(QUANG, { activeCycle: negativeElapsed, autoRestart: true })],
    ])
    const { deps, grants, starts } = createHarness(states)

    expect(settle(deps, T0)).toBe(0)
    expect(grants).toEqual([])
    expect(starts).toEqual([])
    expect(states.get(LAM)!.activeCycle).toBe(notDue)
    expect(states.get(QUANG)!.activeCycle).toBe(negativeElapsed)
  })

  it('settles a cycle whose completesAtMs equals nowMs (due boundary is inclusive)', () => {
    const due = makeCycle(LAM, T0 - CYCLE_MS, T0)
    const states = new Map([[LAM, makeState(LAM, { activeCycle: due })]])
    const { deps, grants } = createHarness(states)

    expect(settle(deps, T0)).toBe(1)
    expect(grants).toEqual([due])
    expect(states.get(LAM)!.activeCycle).toBeUndefined()
  })

  it('settles a due cycle once with autoRestart off — no restart, site goes idle', () => {
    const due = makeCycle(LAM, T0 - CYCLE_MS, T0 - 1)
    const states = new Map([[LAM, makeState(LAM, { activeCycle: due, autoRestart: false })]])
    const { deps, grants, starts } = createHarness(states)

    expect(settle(deps, T0)).toBe(1)
    expect(grants).toEqual([due])
    expect(starts).toEqual([])
    expect(states.get(LAM)!.activeCycle).toBeUndefined()
  })

  it('grants a due cycle but does not restart when canStart rejects the site', () => {
    const due = makeCycle(LAM, T0 - CYCLE_MS, T0 - 1)
    const states = new Map([[LAM, makeState(LAM, { activeCycle: due, autoRestart: true })]])
    const { deps, grants, starts } = createHarness(states, { canStart: () => false })

    expect(settle(deps, T0)).toBe(1)
    expect(grants).toEqual([due])
    expect(starts).toEqual([])
    expect(states.get(LAM)!.activeCycle).toBeUndefined()
  })

  it('forfeits a single due cycle whose duration exceeds the whole cap, re-arming from nowMs', () => {
    const huge = makeCycle(LAM, T0 - CAP_MS - 1, T0) // duration CAP_MS + 1
    const states = new Map([[LAM, makeState(LAM, { activeCycle: huge, autoRestart: true })]])
    const { deps, grants, starts } = createHarness(states)

    expect(settle(deps, T0)).toBe(0)
    expect(grants).toEqual([])
    expect(starts).toEqual([{ siteId: LAM, collectionRealmId: REALM, nowMs: T0 }])
    expect(states.get(LAM)!.activeCycle!.startedAtMs).toBe(T0)
  })

  it('forfeits an oversized due cycle to full idle when autoRestart is off', () => {
    const huge = makeCycle(LAM, T0 - CAP_MS - 1, T0)
    const states = new Map([[LAM, makeState(LAM, { activeCycle: huge, autoRestart: false })]])
    const { deps, grants, starts } = createHarness(states)

    expect(settle(deps, T0)).toBe(0)
    expect(grants).toEqual([])
    expect(starts).toEqual([])
    expect(states.get(LAM)!.activeCycle).toBeUndefined()
  })

  it('clamps a corrupted negative-duration cycle to zero budget cost and settles it', () => {
    // completesAtMs < startedAtMs: Math.max(0, duration) => 0 budget cost.
    const corrupted = makeCycle(LAM, T0 - 1_000, T0 - 5_000)
    const states = new Map([[LAM, makeState(LAM, { activeCycle: corrupted })]])
    const { deps, grants } = createHarness(states)

    expect(settle(deps, T0)).toBe(1)
    expect(grants).toEqual([corrupted])
  })

  it('settles cross-site backlog in global earliest-deadline order, chaining each site at its own completion instant', () => {
    const a1 = makeCycle(LAM, T0, T0 + CYCLE_MS) // due T0+100s, auto chains +100s each
    const b1 = makeCycle(QUANG, T0, T0 + 150_000) // single due T0+150s
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { activeCycle: a1, autoRestart: true })],
      [QUANG, makeState(QUANG, { activeCycle: b1, autoRestart: false })],
    ])
    const { deps, grants, starts } = createHarness(states)

    const now = T0 + 400_000

    expect(settle(deps, now)).toBe(5)
    // Interleaved by deadline across sites — not per-site drain order.
    expect(grants.map((cycle) => [cycle.siteId, cycle.completesAtMs])).toEqual([
      [LAM, T0 + 100_000],
      [QUANG, T0 + 150_000],
      [LAM, T0 + 200_000],
      [LAM, T0 + 300_000],
      [LAM, T0 + 400_000],
    ])
    // Chained restarts backdate to the completion instant with the CURRENT realm.
    for (const [index, start] of starts.entries()) {
      expect(start.siteId).toBe(LAM)
      expect(start.collectionRealmId).toBe(REALM)
      expect(start.nowMs).toBe(T0 + (index + 1) * CYCLE_MS)
    }
    expect(states.get(LAM)!.activeCycle!.completesAtMs).toBe(T0 + 500_000)
    expect(states.get(QUANG)!.activeCycle).toBeUndefined()
  })

  it('an unaffordable earliest cycle forfeits the whole remaining manual backlog', () => {
    // The earliest due cycle costs more than the budget: the loop breaks
    // and the forfeit pass drops EVERY later due cycle too — including
    // affordable ones on other sites.
    const huge = makeCycle(LAM, T0 - CAP_MS - 501, T0 - 500) // duration CAP_MS + 1
    const small = makeCycle(QUANG, T0 - CYCLE_MS, T0 - 100)
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { activeCycle: huge, autoRestart: false })],
      [QUANG, makeState(QUANG, { activeCycle: small, autoRestart: false })],
    ])
    const { deps, grants } = createHarness(states)

    expect(settle(deps, T0)).toBe(0)
    expect(grants).toEqual([])
    expect(states.get(LAM)!.activeCycle).toBeUndefined()
    expect(states.get(QUANG)!.activeCycle).toBeUndefined()
  })

  it('bounds a pathological instant-cycle chain at 5000 settlements (loop guard, no hang)', () => {
    // Every restart completes 1ms after it starts and is always due —
    // without the guard this loop would never exit.
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { activeCycle: makeCycle(LAM, 0, 1), autoRestart: true })],
    ])
    const { deps, grants, starts } = createHarness(states, { restartCycleMs: 1 })

    const now = T0

    expect(settle(deps, now)).toBe(5000)
    expect(grants).toHaveLength(5000)
    // The still-due chain tail is forfeited and re-armed from nowMs.
    expect(starts).toHaveLength(5001)
    expect(starts[5000]).toEqual({ siteId: LAM, collectionRealmId: REALM, nowMs: now })
    expect(states.get(LAM)!.activeCycle!.startedAtMs).toBe(now)
  })
})

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

  it('pays worker cycles only from the budget left after manual settle', () => {
    // The manual cycle costs CAP_MS - CYCLE_MS, leaving exactly one 100s
    // worker completion affordable — the next one in the chain forfeits.
    const manual = makeCycle(QUANG, T0 - (CAP_MS - CYCLE_MS), T0)
    const lane = makeCycle(LAM, T0, T0 + CYCLE_MS)
    const states = new Map<string, ProductionSiteState>([
      [QUANG, makeState(QUANG, { activeCycle: manual, autoRestart: false })],
      [LAM, makeState(LAM, { autoRestart: true, workerCycles: [lane] })],
    ])
    const { deps, grants } = createHarness(states)

    const now = T0 + 350_000
    const options: ProductionOfflineOptions = {
      workerCapacity: 1,
      offlineSinceMs: T0,
      workerAssignments: new Map([[LAM, 1]]),
    }

    expect(settle(deps, now, options)).toBe(2)
    expect(grants).toEqual([manual, lane])
    // Forfeited successors leave only the live chain tail behind.
    expect(states.get(LAM)!.workerCycles!.map((cycle) => cycle.completesAtMs)).toEqual([
      T0 + 400_000,
    ])

    // Control: same worker state, no manual consumer -> all 3 in-window
    // completions are paid.
    const controlStates = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, workerCycles: [makeCycle(LAM, T0, T0 + CYCLE_MS)] })],
    ])
    const control = createHarness(controlStates)

    expect(settle(control.deps, now, options)).toBe(3)
    expect(control.grants).toHaveLength(3)
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
