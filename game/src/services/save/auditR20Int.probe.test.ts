import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import type { RestoreTimeAuthority } from './saveTypes'
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
import { TU_LINH_TRAN_DURATION_MS } from '../../core/economy/TuLinhTranBalance'
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
import type { GameSave } from './SaveSystem'
import type {
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
} from '../../core/production/ProductionTypes'

// ============================================================================
// QA probe - fixpoint r20 INT wave (blind audit of commit 060826af, the r19
// adjudication batch). Pins CALLER-level coherence of the r19 non-finite
// lane guard and the bound-pair contract; mechanism internals stay with
// auditR19Int.probe.test.ts A-E (not re-run here).
//
//   A) settleProductionOffline end-to-end: one NaN-due entry zero-advances
//      the WHOLE site (pending verbatim, no grants, consumedBudgetMs 0),
//      while a sibling site settles normally off the untouched budget.
//   B) tickWorkers observe-mode zero-advance: pending persists verbatim,
//      zero grants/events, allocator slots still land on the state.
//   C) mechanism contract pins: pending entries are the SAME object refs
//      params.pending carried and seededPending is [] - the re-stamp
//      identity Set in ProductionOffline can never touch them.
//   D) bound-pair invariant matrix: stored.expiresAtMs <= min(savedExpires,
//      lastSavedAt + dur) on EVERY authority kind - the stored bound never
//      sits above the payout bound (provenance <= lastSavedAt always).
//   E) legacy undefined-authority restore runs BOTH sides of the pair on
//      the same args: payout accrues AND the storage bound applies.
// ============================================================================

let currentMs = 1_725_160_000_000

const REALM = 'mortal'
const LAM = 'thanh_van_lam'
const QUANG = 'thanh_van_quang'
const CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM[REALM]!, 1) * 1000 // 100_000
const T0 = 1_000_000
const DUR = TU_LINH_TRAN_DURATION_MS

let cycleSeq = 0

function makeCycle(siteId: string, startedAtMs: number, completesAtMs: number): ProductionCycle {
  cycleSeq += 1
  return {
    cycleId: `r20_cycle_${cycleSeq}`,
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

function tltRecord(overrides: Record<string, unknown>) {
  return {
    id: 'fx-tlt',
    sourceItemId: 'tu_linh_tran',
    effectGroup: 'tu_linh_tran',
    cultivationSpeedPercent: 0.25,
    modifiers: [],
    ...overrides,
  }
}

function restoreWith(lastSavedAt: number, expiresAtMs: number, authority?: RestoreTimeAuthority) {
  setActivePinia(createPinia())
  const save = validSave()
  const p = save.player as PlayerData
  p.lastSavedAt = lastSavedAt
  p.cultivationPerSecond = 12.5
  p.persistentTimedEffects = [
    tltRecord({ appliedAtMs: lastSavedAt - 3_600_000, expiresAtMs }),
  ] as never
  const validation = validateGameSaveShape(save)
  expect(validation.ok).toBe(true)
  if (!validation.ok) return null
  const player = usePlayerStore()
  const offline = player.restoreFromSave(validation.normalizedSave as GameSave, authority)
  const stored = player.persistentTimedEffects.find((e) => e.effectGroup === 'tu_linh_tran')
  return { offline, stored }
}

describe('fixpoint r20 INT - r19 batch integration probes', () => {
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

  // ------------------------------------------------------------------
  // A) The guard's zero-advance shape through the REAL settle caller:
  //    a NaN-due entry poisons its own site's advance only - the pending
  //    set persists verbatim (same refs through the seededHeads map), no
  //    grant fires, budget stays whole for the sibling site, and the
  //    allocator still lands slots on the poisoned state.
  // ------------------------------------------------------------------
  it('settle: one NaN-due entry freezes its site verbatim while a sibling settles', () => {
    vi.spyOn(Date, 'now').mockReturnValue(T0 + 400_000)
    const poison = makeCycle(LAM, T0, Number.NaN)
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

    // Poisoned site: zero-advance - the exact refs params.pending carried
    // persist through the seededHeads re-stamp map untouched, in order.
    const lamCycles = states.get(LAM)!.workerCycles!
    expect(lamCycles).toHaveLength(2)
    expect(lamCycles[0]).toBe(poison)
    expect(lamCycles[1]).toBe(siblingSaved)
    expect(Number.isNaN(lamCycles[0]!.completesAtMs)).toBe(true)
    // The finite SIBLING lane did not complete either - the guard is
    // per-site-atomic: one non-finite entry wedges the whole pending set.
    expect(grants.every((g) => g.siteId === QUANG)).toBe(true)
    // consumedBudgetMs 0 for the poisoned site - the sibling still owns
    // the full cap: its two lanes each settle their whole due chain
    // (dues at 50k/100k then 100k steps up to now=400k -> 8 completions).
    expect(settled).toBe(8)
    expect(grants).toHaveLength(8)
    // Allocator runs BEFORE the advance call in both callers - the
    // poisoned site still shows its assigned slots (round-robin 4 over
    // 2 active sites), zero accounting lost to the guard.
    expect(states.get(LAM)!.activeWorkerSlots).toBe(2)
    expect(states.get(QUANG)!.activeWorkerSlots).toBe(2)
  })

  // ------------------------------------------------------------------
  // B) tickWorkers observe-mode zero-advance: the same verbatim shape,
  //    no grant/event emissions, slots already assigned upstream. A
  //    second tick stays wedged - preserve semantics, never mint.
  // ------------------------------------------------------------------
  it('tickWorkers: NaN-due cycle persists verbatim, no grant, slots intact, next tick still wedged', () => {
    const system = createSystem()
    const poison = makeCycle(LAM, T0, Number.NaN)
    const sibling = makeCycle(LAM, T0, T0 + 50_000)
    system.restoreStates([
      makeState(LAM, { autoRestart: true, workerCycles: [poison, sibling] }),
    ])
    const { bag, registry } = createBag()

    system.tickWorkers(T0 + 400_000, bag, registry, REALM, 4)

    const cycles = system.getState(LAM)!.workerCycles!
    expect(cycles).toHaveLength(2)
    // restoreStates detached the payload - pin values, not refs.
    expect(cycles.map((c) => c.cycleId)).toEqual([poison.cycleId, sibling.cycleId])
    expect(Number.isNaN(cycles[0]!.completesAtMs)).toBe(true)
    expect(cycles[1]!.completesAtMs).toBe(T0 + 50_000)
    // No completion -> no grant: empty bag AND empty event queue.
    expect(bag.getAll()).toHaveLength(0)
    expect(system.drainSettlementEvents()).toHaveLength(0)
    // Sole active site took the whole capacity before the guard ran.
    expect(system.getState(LAM)!.activeWorkerSlots).toBe(4)

    // The wedge is deterministic: a later tick replays the guard and
    // still preserves (the finite sibling never mints under poison).
    system.tickWorkers(T0 + 500_000, bag, registry, REALM, 4)
    const cycles2 = system.getState(LAM)!.workerCycles!
    expect(cycles2.map((c) => c.cycleId)).toEqual([poison.cycleId, sibling.cycleId])
    expect(Number.isNaN(cycles2[0]!.completesAtMs)).toBe(true)
    expect(system.drainSettlementEvents()).toHaveLength(0)
  })

  // ------------------------------------------------------------------
  // C) Mechanism contract pins BOTH callers rely on: pending entries
  //    are the identical objects params.pending carried (the offline
  //    re-stamp keys on object identity via Set), seededPending is []
  //    (no seed lanes were constructed - consistent), forfeited 0,
  //    consumedBudgetMs 0. Same shape in observe mode.
  // ------------------------------------------------------------------
  it('zero-advance contract: identical refs, empty seededPending, zero consume - both modes', () => {
    const saved1 = makeCycle(LAM, T0, Number.NaN)
    const saved2 = makeCycle(LAM, T0, T0 + 50_000)

    for (const mode of ['deadline', 'observe'] as const) {
      const result = advanceWorkerLanes({
        siteId: LAM,
        collectionRealmId: REALM,
        siteLevel: 1,
        baseSeconds: CYCLE_BASE_SECONDS_BY_REALM[REALM]!,
        cycleMs: CYCLE_MS,
        pending: [saved1, saved2],
        slots: 3,
        nowMs: T0 + 400_000,
        emptyLaneStartMs: T0,
        advanceMode: mode,
        budgetMs: mode === 'deadline' ? 36_000_000 : undefined,
        rng: () => 0.5,
      })

      expect(result.completed).toHaveLength(0)
      expect(result.forfeited).toBe(0)
      expect(result.consumedBudgetMs).toBe(0)
      // seededPending [] WITH pending [...params.pending] is consistent:
      // seeds only exist when the lane-construction loop ran; the guard
      // returns before it, so no pending entry can carry the mark.
      expect(result.seededPending).toHaveLength(0)
      // Identity pin: the offline caller's Set(seededPending) re-stamp
      // can only ever touch entries it constructed itself.
      expect(result.pending[0]).toBe(saved1)
      expect(result.pending[1]).toBe(saved2)
    }
  })

  // ------------------------------------------------------------------
  // D) Bound-pair invariant matrix: stored.expiresAtMs <= min(savedExpires,
  //    lastSavedAt + DUR) on every authority path - the stored bound
  //    (provenance+dur, provenance <= lastSavedAt) can never exceed the
  //    payout bound (lastSavedAt+dur). Exact expected bound per arm:
  //    dead  -> min(expires, min(authorityNow, Date.now()))
  //    live  -> min(expires, min(lastSavedAt, authorityNow) + dur)
  // ------------------------------------------------------------------
  it('bound-pair invariant: stored expiry never exceeds the payout bound on any authority', () => {
    const cases: Array<{
      name: string
      lastSavedAt: number
      expiresAtMs: number
      authority?: RestoreTimeAuthority
      authorityNowMs: number
    }> = [
      {
        // live claim inside the class max - bound does not bite
        name: 'cold-boot live-honest',
        lastSavedAt: currentMs - 24 * 3_600_000,
        expiresAtMs: currentMs - 24 * 3_600_000 + 23 * 3_600_000,
        authority: {
          kind: 'cold-boot',
          sinceMs: currentMs - 24 * 3_600_000,
          untilMs: currentMs,
        },
        authorityNowMs: currentMs,
      },
      {
        // over-claim: stored clamps at lastSavedAt+dur, payout the same
        name: 'cold-boot over-claim',
        lastSavedAt: currentMs - 24 * 3_600_000,
        expiresAtMs: currentMs - 24 * 3_600_000 + 6 * 86_400_000,
        authority: {
          kind: 'cold-boot',
          sinceMs: currentMs - 24 * 3_600_000,
          untilMs: currentMs,
        },
        authorityNowMs: currentMs,
      },
      {
        // dead at save: raw stamp kept for payout, stored clamps at
        // min(authorityNow, Date.now()) - both <= lastSavedAt+dur
        name: 'cold-boot dead-at-save',
        lastSavedAt: currentMs - 24 * 3_600_000,
        expiresAtMs: currentMs - 25 * 3_600_000,
        authority: {
          kind: 'cold-boot',
          sinceMs: currentMs - 24 * 3_600_000,
          untilMs: currentMs,
        },
        authorityNowMs: currentMs,
      },
      {
        // fast client clock: provenance = until < lastSavedAt - the
        // stored bound lands STRICTLY below the payout bound
        name: 'cold-boot fast-clock',
        lastSavedAt: currentMs + 2 * 3_600_000,
        expiresAtMs: currentMs + 2 * 3_600_000 + 23 * 3_600_000,
        authority: {
          kind: 'cold-boot',
          sinceMs: currentMs - 60_000,
          untilMs: currentMs,
        },
        authorityNowMs: currentMs,
      },
      {
        // live-replacement: elapsed 0 but the storage bound still runs
        name: 'live-replacement over-claim',
        lastSavedAt: currentMs - 3_600_000,
        expiresAtMs: currentMs - 3_600_000 + 6 * 86_400_000,
        authority: { kind: 'live-replacement', nowMs: currentMs },
        authorityNowMs: currentMs,
      },
      {
        // legacy local boot: no authority - Date.now() is the approved now
        name: 'legacy undefined authority',
        lastSavedAt: currentMs - 24 * 3_600_000,
        expiresAtMs: currentMs - 24 * 3_600_000 + 6 * 86_400_000,
        authority: undefined,
        authorityNowMs: currentMs,
      },
    ]

    for (const c of cases) {
      const out = restoreWith(c.lastSavedAt, c.expiresAtMs, c.authority)
      expect(out, c.name).not.toBeNull()
      const stored = out!.stored
      expect(stored, c.name).toBeDefined()

      // Exact arm semantics for this restore.
      const expected =
        c.expiresAtMs <= c.lastSavedAt
          ? Math.min(c.expiresAtMs, Math.min(c.authorityNowMs, currentMs))
          : Math.min(c.expiresAtMs, Math.min(c.lastSavedAt, c.authorityNowMs) + DUR)
      expect(stored!.expiresAtMs, c.name).toBe(expected)

      // The pair invariant - stored bound <= payout bound ALWAYS.
      expect(stored!.expiresAtMs, c.name).toBeLessThanOrEqual(
        Math.min(c.expiresAtMs, c.lastSavedAt + DUR),
      )
    }
  })

  // ------------------------------------------------------------------
  // E) Legacy path parity: restore WITHOUT timeAuthority still runs the
  //    SAME provenance/saveLastSavedAt args - payout accrues over the
  //    elapsed window AND the storage bound clamps the over-claim. No
  //    divergent "payout without storage" path exists.
  // ------------------------------------------------------------------
  it('legacy boot pays AND bounds with the same provenance args', () => {
    const lastSavedAt = currentMs - 24 * 3_600_000
    const expires = lastSavedAt + 6 * 86_400_000 // over-claim vs +24h class max

    const out = restoreWith(lastSavedAt, expires, undefined)
    expect(out).not.toBeNull()

    // Storage side ran: over-claim clamps at lastSavedAt + dur.
    expect(out!.stored!.expiresAtMs).toBe(lastSavedAt + DUR)

    // Payout side ran on the same restore: the elapsed window paid.
    expect(out!.offline.elapsedSeconds).toBeGreaterThan(0)
    expect(out!.offline.cultivation).toBeGreaterThan(0)
  })
})
