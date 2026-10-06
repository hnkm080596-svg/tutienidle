import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import { settleProductionOffline } from '../../core/production/ProductionOffline'
import type { ProductionOfflineDeps } from '../../core/production/ProductionOffline'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  PRODUCTION_OFFLINE_CAP_SECONDS,
  SITE_SPEED_MULTIPLIERS,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import type {
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
} from '../../core/production/ProductionTypes'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import {
  AlchemySystem,
  alchemyJobReservationDigest,
  alchemySecondsFor,
  verifyAlchemyJobReservation,
} from '../../core/alchemy/AlchemySystem'
import type { ActiveAlchemyJob, AlchemyJobReservation } from '../../core/alchemy/AlchemySystem'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { buildProfessionMaterialId } from '../../core/profession/ProfessionMaterial'
import { PillBag } from '../../core/pill/PillBag'
import type { GameSave } from './SaveSystem'

// ============================================================================
// QA repro - fixpoint r21 AUT wave (blind audit of commit be30c152, the
// r20 adjudication batch).
//
// Surface map at this tip:
//  A. The widened advanceWorkerLanes guard (WorkerLaneAdvance.ts:134-157)
//     - non-finite + ordering + |stamp| >= 2^53 on emptyLaneStartMs and
//     pending stamps + non-finite slots. THE KEY QUESTION: is the
//     magnitude pin reachable through the validator? The validator pins
//     every cycle stamp finite + ordered + exact-span +
//     startedAtMs <= lastSavedAt - but NO magnitude pin exists on the
//     stamps or on player.lastSavedAt itself.
//  B. Zero-advance freeze semantics: a bad stamp freezes the WHOLE
//     site's lanes forever (the guard returns pending verbatim, which
//     settle and tickWorkers both re-persist). Measure: per-lane vs
//     per-site vs all-sites scope, permanence, self-heal.
//  C. TLT bound matrix at the new tip: dead-arm boundary, forged
//     markers at both poles, non-finite provenance arms - verify every
//     field flowing into boundTimedEffectClocks is validator-gated.
//  D. seededPending re-stamp: nowMs < honest settleNow early-land, and
//     whether a seeded flag can cross onto a saved chain (via the
//     budget-jump rewrite at WorkerLaneAdvance.ts:232-243).
// ============================================================================

let currentMs = 1_725_160_000_000

const TWO_POW_53 = 2 ** 53 // 9007199254740992
const TWO_POW_52 = 2 ** 52 // 4503599627370496 - persisted timestamp domain bound

// Mortal L1 authored span: ceil(100/1.0)*1000.
const MORTAL_L1_CYCLE_MS = computeCycleSeconds(100, 1) * 1000 // 100000

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

let cycleSeq = 0

function makeCycle(siteId: string, startedAtMs: number, completesAtMs: number): ProductionCycle {
  cycleSeq += 1

  return {
    cycleId: `r21_cycle_${cycleSeq}`,
    siteId,
    collectionRealmId: 'mortal',
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

function createDeps(states: Map<string, ProductionSiteState>): ProductionOfflineDeps {
  const siteDefinitions = new Map<string, ProductionSiteDefinition>(
    THANH_VAN_PRODUCTION_SITES.map((site) => [site.siteId, site]),
  )

  return {
    states,
    getSiteDefinition: (siteId) => siteDefinitions.get(siteId),
    grantCycleRewards: () => {},
  }
}

const FOREST = THANH_VAN_PRODUCTION_SITES[0]!.siteId
const MINE = THANH_VAN_PRODUCTION_SITES[1]!.siteId
const GROTTO = THANH_VAN_PRODUCTION_SITES[2]!.siteId

// Save entry carrying one site with the given workerCycles; marker is
// the crafted player.lastSavedAt the stamps must survive against.
function saveWithSite(
  lastSavedAt: number,
  siteId: string,
  workerCycles: ProductionCycle[],
): Record<string, unknown> {
  const save = validSave()
  const p = save.player as PlayerData
  p.lastSavedAt = lastSavedAt
  save.productionSites = [
    { siteId, level: 1, autoRestart: true, workerCycles },
  ]
  return save
}

describe('fixpoint r21 AUT - r20 adjudication batch repros', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
    lockBetaFeaturesForTests()
    lockBetaWaysForTests()
    lockBetaTalentsForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ------------------------------------------------------------------
  // A1 (surface 1) - REACHABILITY - WAS: the validator admitted a
  // pending pair whose completesAtMs is EXACTLY 2^53 (no magnitude
  // pin existed on the stamps or on lastSavedAt itself). r21 fix:
  // admission co-owns the domain bound - every persisted timestamp
  // cursor rejects |x| >= 2^53, so the crafted pair fails at the
  // gate (on completesAtMs AND on lastSavedAt) and the wedge path
  // dies before restore.
  // ------------------------------------------------------------------
  it('A1 validator REJECTS pending completesAtMs == 2^53 (r21 magnitude pin)', () => {
    const crafted = makeCycle(FOREST, TWO_POW_53 - MORTAL_L1_CYCLE_MS, TWO_POW_53)
    const save = saveWithSite(TWO_POW_53, FOREST, [crafted])

    const validation = validateGameSaveShape(save)
    // The crafted pair still keeps exact span/ordering, but the
    // magnitude pin on the stamps closes admission.
    expect(validation.ok).toBe(false)
    expect(crafted.completesAtMs - crafted.startedAtMs).toBe(MORTAL_L1_CYCLE_MS)
  })

  // ------------------------------------------------------------------
  // A2 (surface 1) - negative boundary - WAS: startedAtMs == -(2^53)
  // admitted (lastSavedAt = 0 covered ordering). r21 fix: the
  // magnitude pin rejects it at the gate.
  // ------------------------------------------------------------------
  it('A2 validator REJECTS pending startedAtMs == -(2^53) (r21 magnitude pin)', () => {
    const crafted = makeCycle(FOREST, -TWO_POW_53, -TWO_POW_53 + MORTAL_L1_CYCLE_MS)
    const save = saveWithSite(0, FOREST, [crafted])

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  // ------------------------------------------------------------------
  // A3 (surface 1) - player.lastSavedAt magnitude - WAS: finite-only
  // pin admitted -1e300. r21 fix: |marker| >= 2^53 rejected; r22
  // (INT-01 derivation sliver + COR-1 stackable-writer escalation)
  // tightened to |marker| >= 2^52 - the ~4.5e15 headroom keeps every
  // derived cursor (offlineSinceMs round-trip, stackable re-drink
  // adds) off the mechanism pin. Sub-bound markers (+-4e15) stay
  // admitted and settle safely (ulp/2 < every authored cycleMs).
  // ------------------------------------------------------------------
  it('A3 validator rejects out-of-domain lastSavedAt, admits sub-bound markers (r22 pin)', () => {
    for (const marker of [-1e300, TWO_POW_53, -TWO_POW_53, 9e15, -9e15, 2 ** 52, -(2 ** 52)]) {
      const save = validSave()
      ;(save.player as PlayerData).lastSavedAt = marker
      expect(validateGameSaveShape(save).ok, `rejected marker ${marker}`).toBe(false)
    }
    for (const marker of [4e15, -4e15, 2 ** 52 - 1, -(2 ** 52 - 1)]) {
      const save = validSave()
      ;(save.player as PlayerData).lastSavedAt = marker
      expect(validateGameSaveShape(save).ok, `admitted marker ${marker}`).toBe(true)
    }
  })

  // ------------------------------------------------------------------
  // A4 (surface 1) - the just-under-pin arm: WAS the 9e15 pair
  // admitted (exact span, Sterbenz). r22: 9e15 > 2^52 - rejected. The
  // deepest admitted pair (4e15) keeps the exact span and is admitted
  // - then never completes (due ~128,000 years out: the sub-bound
  // parked residual, deny-direction).
  // ------------------------------------------------------------------
  it('A4 validator rejects a 9e15 pair; admits the 4e15 pair (residual parks)', () => {
    const tooBig = makeCycle(FOREST, 9e15 - MORTAL_L1_CYCLE_MS, 9e15)
    expect(validateGameSaveShape(saveWithSite(9e15, FOREST, [tooBig])).ok).toBe(false)

    const crafted = makeCycle(FOREST, 4e15 - MORTAL_L1_CYCLE_MS, 4e15)
    const save = saveWithSite(4e15, FOREST, [crafted])

    expect(validateGameSaveShape(save).ok).toBe(true)
    // The exact-span subtraction stays exact at the admitted edge.
    expect(crafted.completesAtMs - crafted.startedAtMs).toBe(MORTAL_L1_CYCLE_MS)
  })

  // ------------------------------------------------------------------
  // B1 (surface 2) - FREEZE SCOPE, per-site: ONE crafted >= 2^53
  // pending entry freezes the WHOLE site's lanes - the honest sibling
  // lane (due long past) gets zero completions, zero budget spend,
  // zero successor respawn, and no empty-lane seeding. The crafted
  // record is re-persisted verbatim, so the freeze is PERMANENT: every
  // later settle AND every online tickWorkers call trips the same
  // guard on the same stamps. Proven permanent by settling twice.
  // ------------------------------------------------------------------
  it('B1 one crafted >= 2^53 pending freezes the whole site permanently (both drivers)', () => {
    const honest = makeCycle(FOREST, 100_000, 200_000)
    const crafted = makeCycle(FOREST, TWO_POW_53 - MORTAL_L1_CYCLE_MS, TWO_POW_53)
    const state = makeState(FOREST, {
      autoRestart: true,
      workerCycles: [honest, crafted],
    })
    const deps = createDeps(new Map([[state.siteId, state]]))

    // First settle: whole site zero-advances.
    const settled1 = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      900_000,
      { workerCapacity: 2, offlineSinceMs: 500_000, rng: () => 0.5 },
    )
    expect(settled1).toBe(0)
    expect(state.workerCycles).toHaveLength(2)
    // Crafted record re-persisted verbatim - self-perpetuating.
    const persisted1 = state.workerCycles!.find((c) => c.cycleId === crafted.cycleId)
    expect(persisted1).toBeDefined()
    expect(persisted1!.completesAtMs).toBe(TWO_POW_53)

    // Second settle (next boot): still frozen - permanence is not
    // a one-shot loss.
    const settled2 = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      9_000_000_000,
      { workerCapacity: 2, offlineSinceMs: 500_000, rng: () => 0.5 },
    )
    expect(settled2).toBe(0)

    // Online driver (tickWorkers passes advanceMode 'observe' +
    // emptyLaneStartMs = nowMs): same verbatim freeze.
    const observe = advanceWorkerLanes({
      siteId: FOREST,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: MORTAL_L1_CYCLE_MS,
      pending: state.workerCycles!,
      slots: 2,
      nowMs: 10_000_000_000,
      emptyLaneStartMs: 10_000_000_000,
      advanceMode: 'observe',
      rng: () => 0.5,
    })
    expect(observe.completed).toHaveLength(0)
    expect(observe.pending).toHaveLength(2)
  })

  // ------------------------------------------------------------------
  // B2 (surface 2) - FREEZE SCOPE, per-lane - MECHANISM-LEVEL feed:
  // a far-future due does NOT trip the guard; it just never comes due.
  // Scope is per-LANE: the honest sibling still completes, respawns,
  // and seeds keep working. Fill all 3 lanes (maxLanes) to freeze the
  // site this way - measured: sibling lane pays normally. (9e15 is
  // gate-rejected at admission since r22; this pins the mechanism's
  // sub-2^53 behavior for non-save feeds.)
  // ------------------------------------------------------------------
  it('B2 sub-pin far-future pending freezes only its own lane (sibling pays)', () => {
    // 4e15 < 2^52: inside the persisted domain - a stamp this far out
    // still parks its own lane forever without tripping the guard.
    const stuck = makeCycle(FOREST, 4e15 - MORTAL_L1_CYCLE_MS, 4e15)
    const honest = makeCycle(FOREST, 100_000, 200_000)
    const state = makeState(FOREST, {
      autoRestart: true,
      workerCycles: [stuck, honest],
    })
    const deps = createDeps(new Map([[state.siteId, state]]))

    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      900_000,
      { workerCapacity: 2, offlineSinceMs: 500_000, rng: () => 0.5 },
    )

    // Honest lane settles its due + successor inside the window.
    expect(settled).toBeGreaterThanOrEqual(1)
    // The crafted lane re-persists untouched - forever parked.
    const parked = state.workerCycles!.find((c) => c.cycleId === stuck.cycleId)
    expect(parked).toBeDefined()
    expect(parked!.completesAtMs).toBe(4e15)
    // It never advances: observe tick at any honest nowMs keeps it.
    const observe = advanceWorkerLanes({
      siteId: FOREST,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: MORTAL_L1_CYCLE_MS,
      pending: [parked!],
      slots: 1,
      nowMs: currentMs,
      emptyLaneStartMs: currentMs,
      advanceMode: 'observe',
      rng: () => 0.5,
    })
    expect(observe.completed).toHaveLength(0)
    expect(observe.pending[0]!.completesAtMs).toBe(4e15)
  })

  // ------------------------------------------------------------------
  // B3 (surface 2) - FREEZE SCOPE, all-sites - MECHANISM-LEVEL ONLY
  // after r21: a crafted deep-past lastSavedAt used to make
  // offlineSinceMs = min(lastSavedAt, authorityNow - elapsed*1000)
  // land at the marker (-1e300). The r21 magnitude pin rejects that
  // marker at the gate, so this arm is now unreachable via saves;
  // the direct-feed call below pins the residual defense: |v| >= 2^53
  // trips the emptyLaneStartMs arm for EVERY site in the settle pass
  // - total production freeze for the call, deny-direction, and an
  // honest window self-heals (nothing poisoned, only denied).
  // Contrast with B1: the stamp arm re-persists inside the state.
  // ------------------------------------------------------------------
  it('B3 crafted lastSavedAt -1e300 freezes ALL sites in one settle, but self-heals', () => {
    const states = new Map<string, ProductionSiteState>([
      [FOREST, makeState(FOREST, { autoRestart: true })],
      [MINE, makeState(MINE, { autoRestart: true })],
      [GROTTO, makeState(GROTTO, { autoRestart: true })],
    ])
    const deps = createDeps(states)

    // offlineSinceMs as derived from lastSavedAt = -1e300 (the marker
    // is the min of the two anchors; it is also what a crafted far-past
    // marker yields on the legacy path).
    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      currentMs,
      { workerCapacity: 3, offlineSinceMs: -1e300, rng: () => 0.5 },
    )

    // Every site tripped the emptyLaneStartMs guard: zero completions,
    // zero seeding anywhere - a whole-economy freeze for this boot.
    expect(settled).toBe(0)
    for (const state of states.values()) {
      expect(state.workerCycles).toHaveLength(0)
    }

    // Self-heal evidence: the same states under an honest window
    // settle normally (nothing was poisoned - only denied).
    const healed = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      currentMs,
      { workerCapacity: 3, offlineSinceMs: currentMs - 300_000, rng: () => 0.5 },
    )
    expect(healed).toBeGreaterThanOrEqual(3)
  })

  // ------------------------------------------------------------------
  // B4 (surface 2) - freeze reach extends past autoRestart: a site
  // with autoRestart=false but in-flight workerCycles still goes
  // through the advance pass (advanceableStates includes
  // workerCycles.length > 0, ProductionOffline.ts:116-118) - a
  // crafted pending there freezes its retained lanes too.
  // ------------------------------------------------------------------
  it('B4 crafted pending freezes a non-autoRestart site with in-flight lanes', () => {
    const honest = makeCycle(FOREST, 100_000, 200_000)
    const crafted = makeCycle(FOREST, TWO_POW_53 - MORTAL_L1_CYCLE_MS, TWO_POW_53)
    const state = makeState(FOREST, {
      autoRestart: false,
      workerCycles: [honest, crafted],
    })
    const deps = createDeps(new Map([[state.siteId, state]]))

    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      900_000,
      { workerCapacity: 0, offlineSinceMs: 500_000, rng: () => 0.5 },
    )

    expect(settled).toBe(0)
    expect(state.workerCycles).toHaveLength(2)
  })

  // ------------------------------------------------------------------
  // B5 (surface 2) - the BELOW-pin deep-past arm: a pending due at
  // -8.9e15 (under the magnitude pin) does not trip the guard; the
  // lane walks completions at exactly its span cost each until the
  // budget drops below cycleMs, then the O(1) jump (WorkerLaneAdvance
  // .ts:219-247) skips the tail. Bounded: paid <= floor(budget/span);
  // the skippedDues forfeit counter inflates to ~1e11 but has NO
  // consumer (result.forfeited is observational - settleWorkersOffline
  // reads only result.completed/.pending/.consumedBudgetMs).
  // ------------------------------------------------------------------
  it('B5 deep-past sub-pin due: bounded pay + O(1) forfeit jump; inflated counter is dead-ended', () => {
    const deepDue = -4e15 // admitted: |x| < 2^52 persisted domain
    const crafted = makeCycle(FOREST, deepDue, deepDue + MORTAL_L1_CYCLE_MS)
    const budgetMs = 50_000 // smaller than one span: the jump arms immediately

    const result = advanceWorkerLanes({
      siteId: FOREST,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: MORTAL_L1_CYCLE_MS,
      pending: [crafted],
      slots: 1,
      nowMs: 1_000_000,
      emptyLaneStartMs: 0,
      advanceMode: 'deadline',
      budgetMs,
      rng: () => 0.5,
    })

    // headCost (100000) > budgetLeft (50000) && cycleMs > budgetLeft:
    // the whole deep tail is skipped in O(1) - nothing paid.
    expect(result.completed).toHaveLength(0)
    expect(result.consumedBudgetMs).toBe(0)
    // Forfeit count = skipped dues ~= (nowMs - deepDue)/cycleMs ~ 4e10
    // - an inflated counter with no consumer.
    expect(result.forfeited).toBeGreaterThan(1e10)
    // Head lands in (nowMs, nowMs + cycleMs] - the post-window
    // position, on a SPAWNED object (lane.saved was cleared), still
    // flagged unseeded (saved-chain provenance).
    expect(result.pending).toHaveLength(1)
    const head = result.pending[0]!
    expect(head.cycleId).not.toBe(crafted.cycleId)
    expect(head.completesAtMs).toBeGreaterThan(1_000_000)
    expect(head.completesAtMs).toBeLessThanOrEqual(1_000_000 + MORTAL_L1_CYCLE_MS)
    expect(result.seededPending).toHaveLength(0)
  })

  // ------------------------------------------------------------------
  // C1 (surface 1) - the absorb question answered arithmetically:
  // EVERY authored cycleMs is an exact multiple of 1000 with minimum
  // 22000 (mortal L9: ceil(100/4.6)*1000). At |stamp| >= 2^53 the
  // float spacing is >= 2 - absorb needs a delta < spacing/2, i.e.
  // < 1ms; no authored or honest cycleMs is ever < 4ms or a
  // non-multiple of 4. The pin boundary `>= 2**53` is therefore
  // correctly placed: spacing jumps to 2 exactly at 2^53, and
  // absorb is already impossible well below it.
  // ------------------------------------------------------------------
  it('C1 every authored cycleMs is a multiple of 1000 >= 22000 - absorb impossible at any magnitude', () => {
    const realmIds = Object.keys(CYCLE_BASE_SECONDS_BY_REALM)
    for (const realmId of realmIds) {
      const base = CYCLE_BASE_SECONDS_BY_REALM[realmId]!
      for (let level = 1; level <= SITE_SPEED_MULTIPLIERS.length; level += 1) {
        const cycleMs = computeCycleSeconds(base, level) * 1000
        expect(cycleMs % 1000, `${realmId} L${level}`).toBe(0)
        expect(cycleMs, `${realmId} L${level}`).toBeGreaterThanOrEqual(22_000)
      }
    }

    // At the pin boundary the smallest authored cycleMs (22000) still
    // cannot absorb: spacing at 2^53 is 2, absorb needs < 1.
    const minCycleMs = 22_000
    for (const stamp of [9e15, TWO_POW_53 - 2, TWO_POW_53, -TWO_POW_53, -9e15]) {
      expect(stamp + minCycleMs, `stamp ${stamp}`).not.toBe(stamp)
      expect(stamp - minCycleMs, `stamp ${stamp}`).not.toBe(stamp)
    }
  })

  // ------------------------------------------------------------------
  // C2 (surface 1) - pin boundary table through the mechanism:
  // |stamp| = 2^53 - 1 advances normally (admitted and harmless);
  // +2^53 and -(2^53) trip the guard on either stamp position;
  // emptyLaneStartMs at +-2^53 trips the same way.
  // ------------------------------------------------------------------
  it('C2 magnitude pin boundary: 2^52-1 advances, +-2^52/2^53 trip on pending and seed arms', () => {
    const run = (overrides: Partial<Parameters<typeof advanceWorkerLanes>[0]>) =>
      advanceWorkerLanes({
        siteId: FOREST,
        collectionRealmId: 'mortal',
        siteLevel: 1,
        baseSeconds: 100,
        cycleMs: MORTAL_L1_CYCLE_MS,
        pending: [],
        slots: 1,
        nowMs: 1_000_000,
        emptyLaneStartMs: 0,
        advanceMode: 'deadline',
        budgetMs: 10_000_000,
        rng: () => 0.5,
        ...overrides,
      })

    // Just under the pin: lane seeded at 2^52-1-MORTAL_L1_CYCLE_MS is
    // not due (due 2^52-1 > nowMs) - pending keeps the seed head.
    const under = run({
      emptyLaneStartMs: TWO_POW_52 - 1 - MORTAL_L1_CYCLE_MS,
    })
    expect(under.pending).toHaveLength(1)
    expect(under.pending[0]!.completesAtMs).toBe(TWO_POW_52 - 1)

    // Boundary values trip on every arm (r30-AUT-3: persisted domain).
    for (const stamp of [TWO_POW_52, -TWO_POW_52, TWO_POW_53, -TWO_POW_53]) {
      const seededArm = run({ emptyLaneStartMs: stamp })
      expect(seededArm.pending, `emptyLaneStartMs ${stamp}`).toHaveLength(0)
      expect(seededArm.completed, `emptyLaneStartMs ${stamp}`).toHaveLength(0)

      const pendingArm = run({
        pending: [makeCycle(FOREST, stamp - MORTAL_L1_CYCLE_MS, stamp)],
      })
      expect(pendingArm.pending, `completesAtMs ${stamp}`).toHaveLength(1)
      expect(pendingArm.completed, `completesAtMs ${stamp}`).toHaveLength(0)

      const startArm = run({
        pending: [makeCycle(FOREST, stamp, stamp + MORTAL_L1_CYCLE_MS)],
      })
      expect(startArm.pending, `startedAtMs ${stamp}`).toHaveLength(1)
      expect(startArm.completed, `startedAtMs ${stamp}`).toHaveLength(0)
    }
  })

  // ------------------------------------------------------------------
  // D1 (surface 3) - every field flowing into boundTimedEffectClocks
  // is validator-gated. appliedAtMs: finite pin (line 1496) +
  // appliedAtMs <= lastSavedAt pin (1508-1517). Both enforced at the
  // seam - the non-finite passthrough arm (player.ts:117-119) is
  // unreachable through validated restores.
  // ------------------------------------------------------------------
  it('D1 non-finite and future appliedAtMs rejected at the shape gate', () => {
    const lastSavedAt = currentMs - 60_000
    for (const applied of [Number.NaN, Number.POSITIVE_INFINITY, lastSavedAt + 1]) {
      const save = validSave()
      const p = save.player as PlayerData
      p.lastSavedAt = lastSavedAt
      p.persistentTimedEffects = [
        tltRecord({ appliedAtMs: applied, expiresAtMs: lastSavedAt + 3_600_000 }),
      ] as never
      expect(validateGameSaveShape(save).ok, `appliedAtMs ${String(applied)}`).toBe(false)
    }
  })

  // ------------------------------------------------------------------
  // D2 (surface 3) - dead-arm under a FORGED FUTURE marker: expires ==
  // lastSavedAt (marker-exact death) with lastSavedAt = 4e15 (just
  // under the r22 2^52 bound) lands the dead arm
  // `expires <= saveLastSavedAt` -> clamps at
  // min(authorityNow, Date.now()) - the record dies at trusted-now in
  // the field epoch, never the crafted epoch. Deny holds at both
  // marker poles.
  // ------------------------------------------------------------------
  it('D2 forged future marker (4e15) + marker-exact expires stores dead at field-now', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const forgedMarker = 4e15
    p.lastSavedAt = forgedMarker
    p.cultivationPerSecond = 12.5
    p.persistentTimedEffects = [
      tltRecord({ appliedAtMs: currentMs - 1_000, expiresAtMs: forgedMarker }),
    ] as never

    const validation = validateGameSaveShape(save)
    // expires <= lastSavedAt + 24h + 7d passes; applied <= lastSavedAt
    // passes - the crafted shape is admitted.
    expect(validation.ok).toBe(true)
    if (!validation.ok) return

    const player = usePlayerStore()
    player.restoreFromSave(validation.normalizedSave as GameSave, {
      kind: 'cold-boot',
      sinceMs: currentMs - 120_000,
      untilMs: currentMs,
    })

    const stored = player.persistentTimedEffects.find(
      (e) => e.effectGroup === 'tu_linh_tran',
    )
    expect(stored).toBeDefined()
    // Dead arm: min(raw, min(authorityNow, Date.now())) = currentMs -
    // the buff is dead NOW, not live-until-4e15.
    expect(stored!.expiresAtMs).toBe(currentMs)
  })

  // ------------------------------------------------------------------
  // D3 (surface 3) - deep-past marker kills the whole TLT class at
  // the GATE. WAS: the provenance ceiling (lastSavedAt + 24h + 7d)
  // absorbed back to the marker, so any live claim was rejected and
  // only dead shapes passed. r21: the magnitude pin rejects the
  // marker itself upstream - every shape under it is dead-on-arrival
  // at admission. Same deny, earlier and simpler.
  // ------------------------------------------------------------------
  it('D3 deep-past marker is rejected at the gate outright (r21 magnitude pin)', () => {
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = -1e300
    p.persistentTimedEffects = [
      tltRecord({
        appliedAtMs: -1e300, // <= lastSavedAt passes
        expiresAtMs: currentMs + 3_600_000,
      }),
    ] as never
    // r21: |marker| >= 2^53 trips the magnitude pin on lastSavedAt
    // itself (and on appliedAtMs) - the whole crafted save is rejected
    // before the TLT ceiling ever evaluates. Louder deny than the
    // collapsed-ceiling rejection it replaces.
    expect(validateGameSaveShape(save).ok).toBe(false)

    // The dead-arm shape under a deep-past marker is unreachable via
    // saves now (the marker itself fails admission).
    const deadSave = validSave()
    const dp = deadSave.player as PlayerData
    dp.lastSavedAt = -1e300
    dp.persistentTimedEffects = [
      tltRecord({ appliedAtMs: -2e300 / 2, expiresAtMs: -1e300 }),
    ] as never
    expect(validateGameSaveShape(deadSave).ok).toBe(false)
  })

  // ------------------------------------------------------------------
  // D4 (surface 3) - the stackable passthrough cannot ride TLT: the
  // validator rejects durationStackable === true on a tu_linh_tran
  // record (line 1552). The non-stackable expiry bound always applies
  // to TLT - the raw-passthrough arm is reserved for authored
  // stackable families (pill regen), covered by the r20-D4 accepted
  // residual.
  // ------------------------------------------------------------------
  it('D4 TLT durationStackable=true rejected - passthrough arm unreachable for TLT', () => {
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = currentMs - 60_000
    p.persistentTimedEffects = [
      tltRecord({
        durationStackable: true,
        appliedAtMs: currentMs - 120_000,
        expiresAtMs: 1e15,
      }),
    ] as never
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  // ------------------------------------------------------------------
  // E1 (surface 4) - saved-lane jump heads are NOT flagged seeded:
  // the O(1) budget jump rewrites a saved lane's head onto a SPAWNED
  // object (lane.saved = undefined, WorkerLaneAdvance.ts:235) but the
  // `seeded` flag stays undefined - seededPending contains only
  // settle-seeded lanes, so the jumped saved-chain head persists
  // UNSHIFTED in the settle epoch. Under positive skew that head sits
  // < Date.now() and the next observe tick pays it once - the same
  // <= 1 cycle/lane residual r20-C4 documented, here reached through
  // the jump path rather than a settled saved head.
  // ------------------------------------------------------------------
  it('E1 jumped saved-chain head persists unshifted (<=1 cycle residual parity with r20-C4)', () => {
    const settleNow = 800_000
    const fieldNow = 1_000_000 // +200s client-clock skew
    vi.mocked(Date.now).mockReturnValue(fieldNow)

    const crafted = makeCycle(FOREST, -1e12, -1e12 + MORTAL_L1_CYCLE_MS)
    const state = makeState(FOREST, {
      autoRestart: true,
      workerCycles: [crafted],
    })
    const deps = createDeps(new Map([[state.siteId, state]]))

    // Cap budget = 36e6ms; each completion costs the 100000ms span,
    // so 360 completions pay, then the jump lands the head.
    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      settleNow,
      { workerCapacity: 1, offlineSinceMs: -1e12, rng: () => 0.5 },
    )

    expect(settled).toBe(Math.floor((PRODUCTION_OFFLINE_CAP_SECONDS * 1000) / MORTAL_L1_CYCLE_MS))
    const heads = state.workerCycles ?? []
    expect(heads).toHaveLength(1)
    const head = heads[0]!
    // Landed in (settleNow, settleNow + cycleMs] in the SETTLE epoch -
    // and because the lane was saved-rooted it is NOT in the re-stamp
    // set: its stamp stays 200s EARLY of field-now.
    expect(head.completesAtMs).toBeGreaterThan(settleNow)
    expect(head.completesAtMs).toBeLessThanOrEqual(settleNow + MORTAL_L1_CYCLE_MS)
    expect(head.completesAtMs).toBeLessThan(fieldNow)
    expect(head.cycleId).not.toBe(crafted.cycleId)
  })

  // ------------------------------------------------------------------
  // E2 (surface 4) - seeded-flag isolation: seededPending contains ONLY
  // lane heads rooted at a settle-time seed. A saved lane can never
  // carry the flag - not through normal advance, not through the jump
  // rewrite. Pin: saved refs never appear in seededPending, so the
  // +max(0, Date.now()-nowMs) re-stamp can never shift a saved chain.
  // ------------------------------------------------------------------
  it('E2 seeded flag never crosses onto a saved lane (normal path and jump path)', () => {
    const saved = makeCycle(FOREST, 850_000, 950_000) // due > settleNow
    const result = advanceWorkerLanes({
      siteId: FOREST,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: MORTAL_L1_CYCLE_MS,
      pending: [saved],
      slots: 3,
      nowMs: 900_000,
      emptyLaneStartMs: 700_000,
      advanceMode: 'deadline',
      budgetMs: 10_000_000,
      rng: () => 0.5,
    })

    // 3 lanes total: 1 saved (due 950k > now) + 2 seeded heads.
    expect(result.pending).toHaveLength(3)
    expect(result.seededPending).toHaveLength(2)
    expect(result.seededPending).not.toContain(saved)
    // The saved lane's own ref survives as the unflagged pending head.
    expect(result.pending).toContain(saved)

    // Jump path: saved deep-past lane under a budget squeeze - the
    // rewritten head is a spawned object and still unflagged.
    const jumped = makeCycle(FOREST, -1e12, -1e12 + MORTAL_L1_CYCLE_MS)
    const jumpedResult = advanceWorkerLanes({
      siteId: FOREST,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: MORTAL_L1_CYCLE_MS,
      pending: [jumped],
      slots: 1,
      nowMs: 900_000,
      emptyLaneStartMs: 0,
      advanceMode: 'deadline',
      budgetMs: 50_000,
      rng: () => 0.5,
    })
    expect(jumpedResult.seededPending).toHaveLength(0)
    expect(jumpedResult.pending).toHaveLength(1)
    expect(jumpedResult.pending[0]!.cycleId).not.toBe(jumped.cycleId)
  })

  // ------------------------------------------------------------------
  // E3 (surface 4) - settleNow float-edge: the dispatch asked whether
  // nowMs < honest settleNow can land heads early. settleNowMs =
  // min(lastSavedAt + elapsed*1000, authorityNowMs): a deep-past
  // marker + honest elapsed makes settleNow absorb to ~the marker
  // (huge negative) - but that path is already frozen by B3's
  // emptyLaneStartMs guard, so no heads mint at all. The remaining
  // edge: a MODERATE crafted past marker yields settleNow < Date.now()
  // with offlineSinceMs also crafted-past - seeded heads then sit
  // inside (settleNow, settleNow + cycleMs], shifted to
  // (Date.now(), Date.now() + cycleMs] by the re-stamp - never early.
  // Pinned: heads land strictly past Date.now() whenever the guard
  // does not trip.
  // ------------------------------------------------------------------
  it('E3 seeded heads land strictly past Date.now() for every admitted marker shape', () => {
    const cases: Array<{ label: string; settleNow: number; fieldNow: number; since: number }> = [
      // crafted past marker, honest window - slow-client shape
      { label: 'marker -10min skew', settleNow: 800_000, fieldNow: 1_400_000, since: 200_000 },
      // marker just below now (minimal window)
      { label: 'narrow window', settleNow: 1_000_000, fieldNow: 1_000_000, since: 990_000 },
      // zero-width-ish: since == settleNow seeds a head AT settleNow
      { label: 'since == settleNow', settleNow: 1_000_000, fieldNow: 1_000_000, since: 1_000_000 },
    ]

    for (const { label, settleNow, fieldNow, since } of cases) {
      vi.mocked(Date.now).mockReturnValue(fieldNow)
      const state = makeState(FOREST, { autoRestart: true })
      const deps = createDeps(new Map([[state.siteId, state]]))

      settleProductionOffline(
        deps,
        new MaterialBag(),
        new MaterialRegistry(),
        'mortal',
        settleNow,
        { workerCapacity: 1, offlineSinceMs: since, rng: () => 0.5 },
      )

      const heads = state.workerCycles ?? []
      expect(heads.length, label).toBe(1)
      const bound = Math.max(settleNow, fieldNow)
      expect(heads[0]!.completesAtMs, label).toBeGreaterThan(bound)
      expect(heads[0]!.completesAtMs, label).toBeLessThanOrEqual(bound + MORTAL_L1_CYCLE_MS)
    }
  })

  // ------------------------------------------------------------------
  // F1 (sibling) - alchemy job stamps carry the SAME magnitude class.
  // r21 pinned |stamp| >= 2^53; r22 tightened to |stamp| >= 2^52;
  // r26 closed the sub-bound park arm at RESTORE: a job post-dating
  // the restore clock is impossible-authored (admission pins
  // startedAtMs <= lastSavedAt, so only a uniformly-shifted/crafted
  // pair reaches here), so restoreJobs re-grounds the pair at the
  // restore clock, preserving the exact authored span and re-deriving
  // the reservation digest over the shifted stamps. The job resumes
  // live in-flight instead of parking forever; the residual band
  // (~now, 4.5e15) shrank to 'parked until the shifted span elapses'.
  // ------------------------------------------------------------------
  it('F1 crafted alchemy job at completesAtMs 4e15 is admitted, then re-anchored at restore', () => {
    const recipe = alchemyRecipes.find(
      (candidate) => candidate.realmId === 'mortal' && candidate.retired !== true,
    )!
    expect(recipe).toBeDefined()

    const variant = recipe.herbVariants[0]!
    const spanMs = alchemySecondsFor(recipe, 1) * 1000
    const startedAtMs = 4e15 - spanMs
    const completesAtMs = 4e15

    const job: Omit<ActiveAlchemyJob, 'reservation'> & { reservation?: Omit<AlchemyJobReservation, 'digest'> & { digest?: number } } = {
      jobId: 'r21_alch_job_1',
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId: variant.materialId,
      startedAtMs,
      completesAtMs,
      roomLevelAtStart: 1,
    }
    const witness: Omit<AlchemyJobReservation, 'digest'> = {
      woodId: buildProfessionMaterialId('wood', recipe.fuelWoodRealmId, variant.age),
      fuelWoodAmount: recipe.fuelWoodAmount,
      spiritStoneCost: recipe.spiritStoneCost,
      herbAmount: recipe.herbAmount,
      specialIngredients: recipe.specialIngredients ?? [],
      costScale: 1,
    }
    const fullJob: ActiveAlchemyJob = {
      ...job,
      reservation: {
        ...witness,
        digest: alchemyJobReservationDigest(job as ActiveAlchemyJob, witness),
      },
    }

    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = 4e15
    save.buildings = [
      { instanceId: 'r21_b1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 },
    ]
    save.alchemyJobs = [fullJob]

    const validation = validateGameSaveShape(save)
    // The whole crafted bundle is self-consistent: digest replays,
    // span exact, ordering holds, started <= marker.
    expect(validation.ok).toBe(true)
    if (!validation.ok) return

    // Mechanism outcome (r26): restore re-grounds the post-dated pair
    // at the restore clock - the job resumes live in-flight with the
    // authored span intact and a re-derived witness digest, instead of
    // parking its slot forever.
    const alchemy = new AlchemySystem()
    alchemy.restoreJobs([fullJob])
    alchemy.tick(currentMs, new PillBag(), () => undefined, () => 0.5)
    expect(alchemy.getJobs()).toHaveLength(1)
    expect(alchemy.getJobs()[0]!.startedAtMs).toBe(currentMs)
    expect(alchemy.getJobs()[0]!.completesAtMs).toBe(currentMs + spanMs)
    expect(
      verifyAlchemyJobReservation(alchemy.getJobs()[0]!, recipe),
    ).toBeNull()
    expect(alchemy.drainSettlementEvents()).toHaveLength(0)
  })

  // ------------------------------------------------------------------
  // F2 (sibling matrix) - the magnitude class repeats on every
  // persisted deadline/cursor field. r21 pinned |x| >= 2^53; r22
  // tightened to |x| >= 2^52. What remains admitted is the sub-bound
  // far-future shape - ACCEPTED residual for the same reason as F1
  // (deny-direction self-harm; any bound at 'now' rejects honest
  // broken-clock saves; the dangerous >= 2^52 arm is closed):
  //   - tribulation.cooldownUntil: admitted at <= lastSavedAt +
  //     TRIBULATION_COOLDOWN_SECONDS*1000 - a crafted 4e15 marker
  //     admits ~4e15 cooldown; r26 clamps it at restore-now + authored
  //     max-remaining (restoreRuntime), so the park arm is closed.
  //   - decompose.nextCycleAt: bounded timestamp now; r26 clamps it at
  //     restore-now + cycleMs, so the park arm is closed (and the r21
  //     O(1) jump makes even a crafted nextCycleAt=0 settle instantly
  //     instead of ~57M no-op iterations).
  //   - buildings[].lastCollectedAt: seconds-domain cursor, bounded
  //     timestamp now; a 4e15 value puts elapsedSeconds <= 0 forever,
  //     parked accrual on the building channel - the cursor channels
  //     keep the residual (no restore re-anchor exists for cursors).
  // ------------------------------------------------------------------
  it('F2 sibling deadline fields admit 4e15 - cooldown/decompose/building parks', () => {
    const withMarker = (mutate: (save: Record<string, unknown>) => void) => {
      const save = validSave()
      const p = save.player as PlayerData
      p.lastSavedAt = 4e15
      mutate(save)
      return validateGameSaveShape(save)
    }

    // Tribulation cooldown admitted just under the crafted ceiling.
    expect(
      withMarker((save) => {
        save.tribulation = { cooldownUntil: 4e15 + 299_999 }
      }).ok,
      'tribulation.cooldownUntil',
    ).toBe(true)

    // Decompose nextCycleAt - no ceiling at all.
    expect(
      withMarker((save) => {
        save.decompose = {
          settings: { workers: 1, gradeFilter: 'all', ageFilter: 'all' },
          nextCycleAt: 4e15,
          started: false,
        }
      }).ok,
      'decompose.nextCycleAt',
    ).toBe(true)

    // Building lastCollectedAt - seconds-domain cursor, no ceiling.
    expect(
      withMarker((save) => {
        save.buildings = [
          { instanceId: 'r21_b2', buildingId: 'pill_room', level: 1, lastCollectedAt: 4e15 },
        ]
      }).ok,
      'buildings[].lastCollectedAt',
    ).toBe(true)
  })
})
