// @vitest-environment node
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { spawnSync } from 'node:child_process'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

declare const process: { env: Record<string, string | undefined> }
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import type { GameSave } from './SaveSystem'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import {
  settleProductionOffline,
  type ProductionOfflineDeps,
} from '../../core/production/ProductionOffline'
import { ProductionSystem } from '../../core/production/ProductionSystem'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import { materials } from '../../data/materials/materials'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_GROTTO_HERBS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_PRODUCTION_SITES,
} from '../../core/production/ProductionCatalog'
import type {
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
} from '../../core/production/ProductionTypes'

// ============================================================================
// QA probe - fixpoint r21 INT wave (re-verification of commit be30c152,
// the r20 adjudication batch: magnitude + ordering + slots pins widened
// into the WorkerLaneAdvance defensive guard).
//
//   A) magnitude trip end-to-end through the REAL settle caller: a
//      pending pair whose stamps sit outside the exact-integer domain
//      (finite, ordered, exact authored span - the shape the validator
//      admits) wedges its WHOLE site verbatim while the sibling site
//      settles off the untouched budget (consumedBudgetMs = 0 isolation).
//   B) the wedge is save-reachable and persistent: validateGameSaveShape
//      admits the crafted pending pair -> restoreStates carries it ->
//      every settle AND every online tick re-trips (deny-direction).
//      This is the r20 split contract exercised on the pending arm, and
//      it is exactly why the adjudication doc's A1 "unreachable from any
//      save today" clause is stale for the magnitude pins.
//   C) seed-arm trip is per-call, not state-poisoning: a tripped settle
//      leaves pending empty, so the next honest tickWorkers seeds the
//      site normally - the freeze has no memory for that arm.
//   D) coverage gap (finding R21-INT-01): slots is pinned NON-FINITE
//      only - a huge FINITE count runs the same unbounded seed-push
//      class R20-COR-2 closed for +Infinity. Child-process evidence.
//   E) coverage gap sibling: budgetMs is finite-pinned only - a huge
//      finite budget + an admitted deep-past window walks O(budget)
//      real completions (1e5 mints at budgetMs=1e10 vs 360 under the
//      honest 10h cap). Caller-arg only - unreachable via the save seam.
//   F) round-trip closure: mechanism-emitted pending always satisfies
//      the guard (finite + ordered + |stamp| < 2^53), so a settle's own
//      output can never self-trip the next settle - no honest freeze.
// ============================================================================

let currentMs = 1_725_160_000_000

const REALM = 'mortal'
const LAM = 'thanh_van_lam'
const QUANG = 'thanh_van_quang'
const CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM[REALM]!, 1) * 1000 // 100_000
const T0 = 1_000_000

let cycleSeq = 0

function makeCycle(siteId: string, startedAtMs: number, completesAtMs: number): ProductionCycle {
  cycleSeq += 1
  return {
    cycleId: `r21_cycle_${cycleSeq}`,
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
  grants: ProductionCycle[]
}

function createDeps(states: Map<string, ProductionSiteState>): Harness {
  const siteDefinitions = new Map<string, ProductionSiteDefinition>(
    THANH_VAN_PRODUCTION_SITES.map((site) => [site.siteId, site]),
  )
  const grants: ProductionCycle[] = []
  return {
    deps: {
      states,
      getSiteDefinition: (siteId) => siteDefinitions.get(siteId),
      grantCycleRewards: (cycle) => {
        grants.push(cycle)
      },
    },
    grants,
  }
}

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

function validSave(): Record<string, unknown> {
  const p = createDefaultPlayer()
  p.realmLevel = 12
  return {
    version: CURRENT_SAVE_VERSION,
    player: p,
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    productionSites: [],
    alchemyJobs: [],
  }
}

describe('fixpoint r21 INT - r20 batch integration probes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    cycleSeq = 0
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
    lockBetaFeaturesForTests()
    lockBetaWaysForTests()
    lockBetaTalentsForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --------------------------------------------------------------------
  // A) magnitude trip through settleProductionOffline: the poisoned site
  //    freezes verbatim (same refs through the re-stamp map), the honest
  //    sibling lane in the SAME site freezes with it (per-site atomicity
  //    by design), and the sibling SITE settles its full due chain off a
  //    budget the poisoned site never touched (consumedBudgetMs = 0).
  // --------------------------------------------------------------------
  it('settle: a 2^53-domain pending stamp freezes its site verbatim while a sibling settles', () => {
    vi.spyOn(Date, 'now').mockReturnValue(T0 + 400_000)
    const poison = makeCycle(LAM, -(2 ** 53) - 200_000, -(2 ** 53) - 100_000)
    const siblingSaved = makeCycle(LAM, T0, T0 + 50_000)
    const cleanSaved = makeCycle(QUANG, T0, T0 + 50_000)
    const states = new Map<string, ProductionSiteState>([
      [
        LAM,
        makeState(LAM, { autoRestart: true, workerCycles: [poison, siblingSaved] }),
      ],
      [QUANG, makeState(QUANG, { autoRestart: true, workerCycles: [cleanSaved] })],
    ])
    const { deps, grants } = createDeps(states)

    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      REALM,
      T0 + 400_000,
      { workerCapacity: 4, offlineSinceMs: T0 },
    )

    // Poisoned site: zero-advance - identical refs persist through the
    // seededHeads re-stamp map, in order, including the honest lane.
    const lamCycles = states.get(LAM)!.workerCycles!
    expect(lamCycles).toHaveLength(2)
    expect(lamCycles[0]).toBe(poison)
    expect(lamCycles[1]).toBe(siblingSaved)
    // Sibling site: budget untouched (consumedBudgetMs = 0 upstream) -
    // it settles its whole window alone: saved lane 4 completions plus
    // its seed lane 4 = 8 grants, all QUANG.
    expect(settled).toBe(8)
    expect(grants).toHaveLength(8)
    expect(grants.every((g) => g.siteId === QUANG)).toBe(true)
    expect(states.get(LAM)!.activeWorkerSlots).toBe(2)
    expect(states.get(QUANG)!.activeWorkerSlots).toBe(2)

    // Idempotent wedge: a second settle over the same state still trips
    // LAM (the crafted entry persists verbatim) and QUANG has nothing
    // left due - no starvation, no over-feed.
    const settled2 = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      REALM,
      T0 + 400_000,
      { workerCapacity: 4, offlineSinceMs: T0 },
    )
    expect(settled2).toBe(0)
    expect(states.get(LAM)!.workerCycles![0]).toBe(poison)
  })

  // --------------------------------------------------------------------
  // B) the pending-arm wedge is REACHABLE through the save seam: the
  //    validator admits a finite/ordered/exact-span pair at |stamp| >=
  //    2^53 (magnitude is mechanism-owned, same split as the -1e308
  //    lastSavedAt marker). restoreStates carries it verbatim, then
  //    every settle AND every online tick re-trips - persistent deny.
  // --------------------------------------------------------------------
  it('validator admits a 2^53-domain pending pair; the wedge persists across settle and tick', () => {
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = -1e16
    const crafted = makeCycle(LAM, -1e16, -1e16 + 100_000)
    save.productionSites = [
      {
        siteId: LAM,
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 0,
        workerCycles: [crafted],
      },
    ]

    const validation = validateGameSaveShape(save)
    // ADMITTED: finite, ordered, exact authored span, startedAtMs <=
    // lastSavedAt - no magnitude pin exists at the shape gate (the
    // mechanism owns it, same split contract as R20-COR-1).
    expect(validation.ok).toBe(true)
    if (!validation.ok) return

    const system = createSystem()
    const { bag, registry } = createBag()
    system.restoreStates(
      (validation.normalizedSave as GameSave).productionSites as ProductionSiteState[],
    )

    // Offline settle wedges: zero completions, zero events, verbatim.
    const settled = system.settleOffline(bag, registry, REALM, T0 + 400_000, {
      workerCapacity: 4,
      offlineSinceMs: T0,
    })
    expect(settled).toBe(0)
    expect(system.drainSettlementEvents()).toHaveLength(0)
    expect(system.getState(LAM)!.workerCycles).toHaveLength(1)
    expect(system.getState(LAM)!.workerCycles![0]!.startedAtMs).toBe(-1e16)

    // Online tick wedges too - the crafted entry is re-persisted every
    // call, so the site stays dead (deny-direction, per-site atomic).
    system.tickWorkers(T0 + 500_000, bag, registry, REALM, 4)
    expect(system.getState(LAM)!.workerCycles).toHaveLength(1)
    expect(system.getState(LAM)!.workerCycles![0]!.completesAtMs).toBe(-1e16 + 100_000)
    expect(system.drainSettlementEvents()).toHaveLength(0)
  })

  // --------------------------------------------------------------------
  // C) seed-arm trip is per-call: a crafted magnitude emptyLaneStartMs
  //    zero-advances one settle; with pending left EMPTY the site has
  //    no persistent wedge - the next honest tick seeds lanes normally.
  // --------------------------------------------------------------------
  it('seed-arm trip leaves no residue: next honest tickWorkers resumes the site', () => {
    const system = createSystem()
    const { bag, registry } = createBag()
    system.restoreStates([makeState(LAM, { autoRestart: true })])

    // Crafted deep-past window start: settle trips, persists nothing.
    const settled = system.settleOffline(bag, registry, REALM, T0 + 400_000, {
      workerCapacity: 4,
      offlineSinceMs: -1e308,
    })
    expect(settled).toBe(0)
    expect(system.getState(LAM)!.workerCycles).toHaveLength(0)

    // Honest tick: the site seeds both allocated lanes at nowMs - the
    // trip was one call, not a poisoned record.
    system.tickWorkers(T0 + 500_000, bag, registry, REALM, 4)
    const cycles = system.getState(LAM)!.workerCycles!
    expect(cycles).toHaveLength(4)
    expect(cycles.every((c) => c.startedAtMs === T0 + 500_000)).toBe(true)
    expect(cycles.every((c) => c.completesAtMs === T0 + 500_000 + CYCLE_MS)).toBe(true)
  })

  // --------------------------------------------------------------------
  // D) R21-INT-01 coverage gap: slots is pinned NON-FINITE only. A huge
  //    FINITE count runs the identical unbounded seed-push class the
  //    +Infinity pin closed - 1e9 pushes OOM the capped heap (or run
  //    past the timeout) before a single completion. Child-process
  //    evidence; the control proves the harness is clean under the cap.
  // --------------------------------------------------------------------
  it('slots = 1e9 (finite) dies in the child - open sibling of the R20-COR-2 class', { timeout: 90_000 }, () => {
    const spec = fileURLToPath(new URL('./auditR21IntSlotsHuge.probe.test.ts', import.meta.url))
    const vitestBin = fileURLToPath(new URL('../../../node_modules/.bin/vitest', import.meta.url))
    const cwd = fileURLToPath(new URL('../../../', import.meta.url))
    try {
      const control = spawnSync(vitestBin, ['run', spec, '--reporter=dot'], {
        cwd,
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=768' },
        timeout: 30_000,
      })
      expect(control.status).toBe(0)

      const result = spawnSync(vitestBin, ['run', spec, '--reporter=dot'], {
        cwd,
        env: {
          ...process.env,
          R21_SLOTS_HUGE_PROBE: '1',
          NODE_OPTIONS: '--max-old-space-size=768',
        },
        timeout: 30_000,
      })

      // OPEN GAP: the child cannot exit 0 - the seed loop pushes ~1e9
      // lane cursors until the heap dies (or the timeout kills it). If
      // this ever exits 0 a magnitude bound on slots landed - flip this
      // to a deny pin.
      expect(result.status !== 0 || result.error !== undefined).toBe(true)
    } finally {
      spawnSync('pkill', ['-f', 'auditR21IntSlotsHuge'], { timeout: 5_000 })
    }
  })

  // --------------------------------------------------------------------
  // E) R21-INT-01 sibling arm: budgetMs is finite-pinned only. The
  //    admitted deep-past window start (-8e15 sits INSIDE the exact-
  //    integer domain, so the magnitude pin lets it through) plus a
  //    crafted caller budget mints O(budget / cycleMs) REAL completions
  //    - linear in the caller scalar, not the honest 10h cap's ~360.
  // --------------------------------------------------------------------
  it('huge finite budgetMs mints O(budget) completions against an admitted deep-past window', () => {
    const base = {
      siteId: 'probe',
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: CYCLE_BASE_SECONDS_BY_REALM[REALM]!,
      cycleMs: CYCLE_MS,
      pending: [] as ProductionCycle[],
      slots: 1,
      nowMs: T0,
      emptyLaneStartMs: -8e15, // admitted: 8e15 < 2^53
      advanceMode: 'deadline' as const,
    }

    const honestCap = advanceWorkerLanes({ ...base, budgetMs: 36_000_000 })
    // Under the real 10h cap the same window yields ~360 completions
    // then the budget-exhaustion jump covers the rest in O(1).
    expect(honestCap.completed).toHaveLength(360)
    expect(honestCap.consumedBudgetMs).toBe(36_000_000)

    // A caller-supplied budget 278x the cap mints 278x the real grants:
    // the settle walk is linear in the unclamped scalar, not in the
    // window the economy authorized.
    const hugeBudget = advanceWorkerLanes({ ...base, budgetMs: 1e10 })
    expect(hugeBudget.completed).toHaveLength(100_000)
    expect(hugeBudget.consumedBudgetMs).toBe(1e10)
    // The remaining ~8e10 dues still collapse through the jump arm.
    expect(hugeBudget.forfeited).toBeGreaterThan(1e9)
  })

  // --------------------------------------------------------------------
  // F) round-trip closure: mechanism output is always guard-admissible
  //    input. Settle once (honest + deep-past-admitted windows), feed
  //    the emitted pending back in - finite, ordered, inside the
  //    magnitude domain on every stamp, so the site never self-trips.
  // --------------------------------------------------------------------
  it('emitted pending is always re-admissible: finite, ordered, inside the exact-integer domain', () => {
    for (const start of [T0, 0, -8e15]) {
      const first = advanceWorkerLanes({
        siteId: 'probe',
        collectionRealmId: REALM,
        siteLevel: 1,
        baseSeconds: CYCLE_BASE_SECONDS_BY_REALM[REALM]!,
        cycleMs: CYCLE_MS,
        pending: [],
        slots: 2,
        nowMs: T0 + 400_000,
        emptyLaneStartMs: start,
        advanceMode: 'deadline',
        budgetMs: 36_000_000,
      })

      expect(first.pending.length).toBeGreaterThan(0)
      for (const cycle of first.pending) {
        expect(Number.isFinite(cycle.startedAtMs)).toBe(true)
        expect(Number.isFinite(cycle.completesAtMs)).toBe(true)
        expect(cycle.completesAtMs).toBeGreaterThan(cycle.startedAtMs)
        expect(Math.abs(cycle.startedAtMs)).toBeLessThan(2 ** 53)
        expect(Math.abs(cycle.completesAtMs)).toBeLessThan(2 ** 53)
      }

      // The mechanism's own output can never wedge the next call -
      // guard-admissibility is closed under settle.
      const second = advanceWorkerLanes({
        siteId: 'probe',
        collectionRealmId: REALM,
        siteLevel: 1,
        baseSeconds: CYCLE_BASE_SECONDS_BY_REALM[REALM]!,
        cycleMs: CYCLE_MS,
        pending: first.pending,
        slots: 2,
        nowMs: T0 + 500_000,
        emptyLaneStartMs: start,
        advanceMode: 'deadline',
        budgetMs: 36_000_000,
      })
      expect(second.pending.length).toBeGreaterThan(0)
    }
  })
})
