// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/PlayerData'
import { GameManager } from '../../core/game/GameManager'
import type { GameSave } from './saveTypes'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { primeMortalCreationPick } from './GameSave.fixture'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { MaterialBag } from '../../core/material/MaterialBag'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import type { ProductionCycle } from '../../core/production/ProductionTypes'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'
import { scopeHiddenPillFamilyOfId } from '../../core/betaScope'
import { TU_LINH_TRAN_DURATION_MS } from '../../core/economy/TuLinhTranBalance'
import { CombatClock, ManualClockSource } from '../../core/battle/turn/CombatClock'

// ============================================================================
// QA probe - fixpoint r33 COR wave. Audits the r32 adjudication batch at
// a014b7fb (codex/hoa-cau-fireball-vfx):
//
//   (A) ORDERING PARITY - CLAIM CHECKED: restoreJobs drops inverted pairs;
//       restoreStates' shift arm requires completes > started but otherwise
//       PARKS the inverted pair verbatim. CONFIRMED FINDING COR-F1 (Low):
//       the asymmetry retains poison on the production side - a parked
//       inverted workerCycle (i) refuses every later save write at the
//       outgoing-shape gate (F-A11-4 ordering pin on the wire form), and
//       (ii) freezes EVERY lane of that site through advanceWorkerLanes'
//       pending.some() zero-advance deny - collateral beyond the crafted
//       lane. Reachable only via an admission-bypassed payload (the same
//       pin rejects the shape upstream), so the whole arm is ungated-feed
//       defense-in-depth -> Low. The r32 adjudication chose park over mint
//       (correct: stops re-minting fresh inverted pairs) but the residue
//       still diverges from the sibling's drop.
//   (B) mintedSpanMs headroom - CLAIM VERIFIED for every minted ms stamp:
//       seeded heads (emptyLaneStartMs + authored span), chain successors
//       (lane.startMs <= nowMs + authored span), saved lanes (pre-pinned
//       domain). NaN authored span denies via !(NaN < x). Residual Nits:
//       minted NON-ms fields (siteLevelAtStart / rollSeed /
//       collectionRealmId<->baseSeconds coherence) are caller-trusted -
//       a malformed caller mints records the write gate refuses.
//   (C) field-epoch re-stamp - CLAIM VERIFIED: the completes-only headroom
//       decides correctly (completes is the strict-max stamp of an ordered
//       pair), and a skipped head keeps in-domain settle-epoch stamps
//       forever (parked < 2^52).
//   (D) cap clamps - CLAIM VERIFIED for finite inputs: Decompose/TLT caps
//       land <= 2^52-1 under every restoreNow edge. Nits: a NaN cycleMs
//       (constructor-crafted option, never produced by GameManager) still
//       propagates NaN through Math.min into nextCycleAt; a NaN tribulation
//       slice rides verbatim but serializeRuntime's `> 0` gate silently
//       drops it (never persisted - the live effect is a cooldown gate
//       that reads open).
//   (E) applyTimedEffect - CLAIM VERIFIED for all finite/NaN/+-Inf caller
//       pairs: TLT ceiling now + 24h + 7d matches the writer bound, other
//       groups keep 2^52-1 (admission's only expiry pin for pill effects),
//       non-finite stamps coerce before clamping. Residual Nits: a
//       non-finite EXISTING expiry still propagates NaN through both merge
//       arms (live-state trust, unreachable via save); a pushed TLT record
//       with expires < applied fails the ordering pin at the next write
//       (transient - tickTimedEffects drops the dead record the same tick);
//       a ceiling-claimed expiry + backward clock skew overshoots the
//       lastSavedAt-anchored bound (narrow crafted window).
//   (F) bootGame resumeCombat - CLAIM VERIFIED: CombatClock.resume early-
//       returns on 'stopped' (true no-op), deletes only the named reason,
//       resumes only when the set empties (other freezes preserved).
//   (G) Boundary rows: -1/-0/+0/2^52-1/2^52, coherent vs incoherent
//       (baseSeconds, cycleMs), restoreNow at bound-1.
//
// ASCII only (P15).
// ============================================================================

let currentMs = 1_725_160_000_000

const BOUND = 2 ** 52
const SITE_ID = THANH_VAN_PRODUCTION_SITES[0]!.siteId
// The coherent cycleMs real callers compute for mortal / site level 1.
const MORTAL_BASE_SECONDS = CYCLE_BASE_SECONDS_BY_REALM.mortal!
const MORTAL_CYCLE_MS = computeCycleSeconds(MORTAL_BASE_SECONDS, 1) * 1000

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

/** A real writer-produced save in wire form (validateGameSaveShape-clean). */
function validWireSave(): GameSave {
  const writer = registeredManager()
  const player = createDefaultPlayer()
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer))) as GameSave
}

/** Production-side save shape needs the site's host building + capacity. */
function productionSiteWire(save: GameSave, cycles: ProductionCycle[]): GameSave {
  save.buildings = [
    { instanceId: 'bld_chq', buildingId: 'chi_hien_quan', level: 1, lastCollectedAt: 0 },
  ] as never
  ;(save.player as unknown as Record<string, unknown>).autoWorkerCapacity = 3
  save.productionSites = [
    {
      siteId: SITE_ID,
      level: 1,
      autoRestart: true,
      activeWorkerSlots: 1,
      workerCycles: cycles,
    },
  ] as never
  return save
}

function mortalRecipe() {
  return alchemyRecipes.find((r) => r.id === 'alchemy_tu_linh_dan_mortal')!
}

function workerCycle(startedAtMs: number, completesAtMs: number, cycleId = 'cyc_probe'): ProductionCycle {
  return {
    cycleId,
    siteId: SITE_ID,
    collectionRealmId: 'mortal',
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 1,
    startedAtMs,
    completesAtMs,
  }
}

function laneParams(overrides: Partial<Parameters<typeof advanceWorkerLanes>[0]> = {}) {
  return {
    siteId: SITE_ID,
    collectionRealmId: 'mortal',
    siteLevel: 1,
    baseSeconds: MORTAL_BASE_SECONDS,
    cycleMs: MORTAL_CYCLE_MS,
    pending: [] as ProductionCycle[],
    slots: 1,
    nowMs: currentMs,
    emptyLaneStartMs: currentMs,
    advanceMode: 'observe' as const,
    ...overrides,
  }
}

/** A live regen pill + its writer-shaped effect fields (non-TLT group). */
function regenSource() {
  const pill = pills.find(
    (entry) =>
      entry.realmId !== undefined &&
      entry.effects.some((e) => e.type === 'regen') &&
      scopeHiddenPillFamilyOfId(entry.id) === null,
  )!
  const regen = pill.effects.find((e) => e.type === 'regen')!
  return {
    pillId: pill.id,
    realmId: pill.realmId!,
    effect: {
      sourceItemId: pill.id,
      effectGroup: regen.effectGroup ?? 'pill_regen',
      durationStackable: regen.stackable ?? false,
      modifiers: [],
    },
  }
}

function tltEffect(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fx_tlt',
    sourceItemId: 'tu_linh_tran',
    effectGroup: 'tu_linh_tran',
    appliedAtMs: currentMs,
    expiresAtMs: currentMs + TU_LINH_TRAN_DURATION_MS,
    modifiers: [],
    cultivationSpeedPercent: 0.25,
    ...overrides,
  } as PersistentTimedEffect
}

beforeEach(() => {
  setActivePinia(createPinia())
  currentMs = 1_725_160_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------------------
// (A) COR-F1 (CONFIRMED, Low) - ordering parity is one-sided: alchemy drops
//     the inverted pair at the boundary; production parks it verbatim, and
//     the parked pair wedges every later save write AND freezes every lane
//     on the site (pending.some deny is site-wide).
// ----------------------------------------------------------------------------

describe('r33 COR - A: inverted-pair park retains poison (COR-F1)', () => {
  it('restoreStates parks the inverted pair verbatim; a healthy sibling lane freezes with it', () => {
    const manager = registeredManager()
    const healthy = workerCycle(currentMs - 200_000, currentMs - 100_000, 'cyc_healthy')
    const inverted = workerCycle(currentMs - 10_000, currentMs - 20_000, 'cyc_inverted')
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [inverted, healthy],
        },
      ] as never,
      currentMs,
    )

    // r32 park arm: the inverted pair stays in live state verbatim.
    const parked = manager.productionSystem.getState(SITE_ID)!.workerCycles!
    expect(parked).toHaveLength(2)
    expect(parked[0]!.startedAtMs).toBe(currentMs - 10_000)
    expect(parked[0]!.completesAtMs).toBe(currentMs - 20_000)

    // tickWorkers -> advanceWorkerLanes' pending.some() deny zero-advances
    // the WHOLE site: the healthy past-due lane never settles.
    manager.productionSystem.tickWorkers(
      currentMs + 1_000,
      manager.materialBag,
      manager.materialRegistry,
      'mortal',
      4,
    )
    const afterTick = manager.productionSystem.getState(SITE_ID)!.workerCycles!
    expect(afterTick).toHaveLength(2)
    expect(afterTick[1]!.startedAtMs).toBe(currentMs - 200_000)
    expect(afterTick[1]!.completesAtMs).toBe(currentMs - 100_000)
  })

  it('the parked inverted pair refuses every later save write (outgoing-shape gate)', () => {
    const manager = registeredManager()
    const inverted = workerCycle(currentMs - 10_000, currentMs - 20_000, 'cyc_inverted')
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [inverted],
        },
      ] as never,
      currentMs,
    )
    const persisted = manager.productionSystem.getState(SITE_ID)!.workerCycles!

    // Reproduce the write-gate check driveSave runs on the wire form: the
    // parked pair lands verbatim in the save, and the ordering pin
    // (F-A11-4) refuses it - a permanent wedge until the lane is removed
    // by hand (nothing in the live path removes it).
    const wire = productionSiteWire(validWireSave(), persisted as never)
    const shape = validateGameSaveShape(wire)
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some((issue) => issue.path.includes('workerCycles')),
    ).toBe(true)
  })

  it('contrast: restoreJobs drops the same inverted shape outright - no residue', () => {
    const manager = registeredManager()
    const recipe = mortalRecipe()
    const variant = recipe.herbVariants[0]!
    const inverted = alchemyJobFixture(
      {
        jobId: 'inv',
        recipeId: recipe.id,
        pillId: recipe.pillId,
        herbMaterialId: variant.materialId,
        startedAtMs: currentMs - 10_000,
        completesAtMs: currentMs - 20_000,
        roomLevelAtStart: 1,
      },
      undefined,
      recipe,
    )
    manager.alchemySystem.restoreJobs([inverted] as never, currentMs)
    expect(manager.alchemySystem.getJobs()).toHaveLength(0)
  })

  it('boundary completes === started: alchemy drops, production parks (same <= pin shape)', () => {
    const manager = registeredManager()
    const recipe = mortalRecipe()
    const variant = recipe.herbVariants[0]!
    const zeroSpanJob = alchemyJobFixture(
      {
        jobId: 'zero_span',
        recipeId: recipe.id,
        pillId: recipe.pillId,
        herbMaterialId: variant.materialId,
        startedAtMs: currentMs,
        completesAtMs: currentMs,
        roomLevelAtStart: 1,
      },
      undefined,
      recipe,
    )
    manager.alchemySystem.restoreJobs([zeroSpanJob] as never, currentMs)
    expect(manager.alchemySystem.getJobs()).toHaveLength(0)

    const manager2 = registeredManager()
    const zeroSpanCycle = workerCycle(currentMs, currentMs, 'cyc_zero')
    manager2.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [zeroSpanCycle],
        },
      ] as never,
      currentMs,
    )
    expect(manager2.productionSystem.getState(SITE_ID)!.workerCycles!).toHaveLength(1)
  })

  it('control: an in-domain post-dated ordered pair still shifts (park is inverted-only)', () => {
    const manager = registeredManager()
    const shifted = workerCycle(currentMs + 5_000, currentMs + 5_000 + MORTAL_CYCLE_MS)
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [shifted],
        },
      ] as never,
      currentMs,
    )
    const cycle = manager.productionSystem.getState(SITE_ID)!.workerCycles![0]!
    expect(cycle.startedAtMs).toBe(currentMs)
    expect(cycle.completesAtMs).toBe(currentMs + MORTAL_CYCLE_MS)
  })

  it('upstream admission makes the park arm ungated-feed only (F-A11-4 rejects the shape first)', () => {
    const wire = productionSiteWire(
      validWireSave(),
      [workerCycle(currentMs - 10_000, currentMs - 20_000)] as never,
    )
    expect(validateGameSaveShape(wire).ok).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// (B) mintedSpanMs headroom - claim VERIFIED on every minted ms stamp.
// ----------------------------------------------------------------------------

describe('r33 COR - B: mintedSpanMs bounds every minted stamp (verified)', () => {
  it.each([
    ['nowMs = 2^52 - authoredSpan', BOUND - MORTAL_CYCLE_MS, false],
    ['nowMs = 2^52 - authoredSpan - 1', BOUND - MORTAL_CYCLE_MS - 1, true],
    ['nowMs = 2^52 - 1', BOUND - 1, false],
  ])('coherent pair headroom: %s', (_label, nowMs, admitted) => {
    const result = advanceWorkerLanes(laneParams({ nowMs, emptyLaneStartMs: nowMs }))
    if (admitted) {
      expect(result.seededPending).toHaveLength(1)
      expect(result.seededPending[0]!.completesAtMs).toBeLessThan(BOUND)
    } else {
      expect(result.seededPending).toHaveLength(0)
      expect(result.pending).toHaveLength(0)
    }
  })

  it('incoherent pair (cycleMs << authored span): headroom denominates the authored span', () => {
    // cycleMs 1_000 vs authored 100_000 - the OLD formula admitted at
    // nowMs = BOUND - 10_000 while the minted completes escaped the
    // domain; r32 denies on max(cycleMs, authoredSpan).
    const result = advanceWorkerLanes(
      laneParams({
        cycleMs: 1_000,
        nowMs: BOUND - 10_000,
        emptyLaneStartMs: BOUND - 10_000,
      }),
    )
    expect(result.pending).toHaveLength(0)
    expect(result.seededPending).toHaveLength(0)
  })

  it('incoherent pair (cycleMs > authored span): over-bounds - deny at cycleMs edge', () => {
    // cycleMs = 1e15 >> authored 100_000: minted completes would still fit
    // (start + 100_000) but the chain dues are denominated by the max -
    // deny-lean over-guard on an incoherent input (harmless).
    const result = advanceWorkerLanes(
      laneParams({ cycleMs: 1e15, nowMs: BOUND - 5e14 }),
    )
    expect(result.pending).toHaveLength(0)
  })

  it.each([
    ['baseSeconds NaN', Number.NaN],
    ['baseSeconds +Infinity', Number.POSITIVE_INFINITY],
    ['baseSeconds -Infinity', Number.NEGATIVE_INFINITY],
    ['baseSeconds 1e18', 1e18],
  ])('weird baseSeconds: %s denies the mint (no stamps escape)', (_label, baseSeconds) => {
    const result = advanceWorkerLanes(laneParams({ baseSeconds }))
    expect(result.seededPending).toHaveLength(0)
  })

  it.each([
    ['siteLevel NaN', Number.NaN, MORTAL_BASE_SECONDS * 1000],
    ['siteLevel 1.7 (fractional)', 1.7, MORTAL_BASE_SECONDS * 1000],
    ['siteLevel 99 (over range)', 99, Math.ceil(MORTAL_BASE_SECONDS / 4.6) * 1000],
    ['siteLevel -3 (under range)', -3, MORTAL_BASE_SECONDS * 1000],
  ])('weird siteLevel: %s resolves the multiplier to a finite span', (_label, siteLevel, spanMs) => {
    const result = advanceWorkerLanes(
      laneParams({ siteLevel, cycleMs: spanMs }),
    )
    expect(result.seededPending).toHaveLength(1)
    expect(result.seededPending[0]!.completesAtMs).toBe(currentMs + spanMs)
    expect(Number.isFinite(result.seededPending[0]!.completesAtMs)).toBe(true)
  })

  it('Nit COR-F2a: a NaN siteLevel mints siteLevelAtStart NaN - the write gate refuses it', () => {
    // The headroom denominates the ms stamps; the minted record's
    // siteLevelAtStart rides the caller param verbatim -> a malformed
    // caller (never the real ones - state.level is integer-pinned)
    // produces a record the shape gate rejects on the next write.
    const result = advanceWorkerLanes(
      laneParams({ siteLevel: Number.NaN, cycleMs: MORTAL_CYCLE_MS }),
    )
    expect(result.seededPending).toHaveLength(1)
    expect(Number.isNaN(result.seededPending[0]!.siteLevelAtStart)).toBe(true)

    const wire = productionSiteWire(
      validWireSave(),
      [result.seededPending[0]!] as never,
    )
    expect(validateGameSaveShape(wire).ok).toBe(false)
  })

  it('Nit COR-F2b: an out-of-[0,1) rng mints a rollSeed the validator refuses', () => {
    const result = advanceWorkerLanes(
      laneParams({ rng: () => 1.5 }),
    )
    expect(result.seededPending).toHaveLength(1)
    expect(result.seededPending[0]!.rollSeed).toBeGreaterThan(0x7fffffff)

    const wire = productionSiteWire(
      validWireSave(),
      [result.seededPending[0]!] as never,
    )
    expect(validateGameSaveShape(wire).ok).toBe(false)
  })

  it('Nit COR-F2c: incoherent collectionRealmId + baseSeconds mints a wrong-span record the gate refuses', () => {
    // Caller claims the cycle belongs to realm 'tribulation' but passes
    // the mortal base - the minted span = mortal authored span, while the
    // validator computes expected span from the tribulation base.
    const result = advanceWorkerLanes(
      laneParams({ collectionRealmId: 'tribulation', rng: () => 0.5 }),
    )
    expect(result.seededPending).toHaveLength(1)
    const minted = result.seededPending[0]!
    expect(minted.completesAtMs - minted.startedAtMs).toBe(MORTAL_CYCLE_MS)

    const wire = productionSiteWire(
      validWireSave(),
      [{ ...minted, collectionRealmId: 'tribulation' }] as never,
    )
    const shape = validateGameSaveShape(wire)
    expect(shape.ok).toBe(false)
  })

  it('saved lanes (existing pending) carry pre-pinned stamps - domain check keeps >= 2^52 parked', () => {
    const result = advanceWorkerLanes(
      laneParams({ pending: [workerCycle(1, BOUND - 1)], emptyLaneStartMs: undefined }),
    )
    expect(result.pending).toHaveLength(1)
    expect(result.pending[0]!.completesAtMs).toBe(BOUND - 1)
  })
})

// ----------------------------------------------------------------------------
// (C) field-epoch re-stamp - claim VERIFIED: skip parks in-domain; shift
//     preserves ordering; completes-headroom decides both stamps.
// ----------------------------------------------------------------------------

describe('r33 COR - C: seeded-head re-stamp boundary (verified)', () => {
  function settleWithClock(deviceNow: number) {
    const manager = registeredManager()
    const settleNow = 1_000_000_000_000 // authorized window end (past epoch)
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [],
        },
      ] as never,
      settleNow,
    )
    vi.spyOn(Date, 'now').mockImplementation(() => deviceNow)
    manager.productionSystem.settleOffline(
      manager.materialBag,
      manager.materialRegistry,
      'mortal',
      settleNow,
      { workerCapacity: 1, offlineSinceMs: settleNow - 120_000, rng: () => 0.5 },
    )
    return manager.productionSystem.getState(SITE_ID)!.workerCycles!
  }

  it('completes + shift = 2^52 - 1: the seeded head shifts cleanly in-domain', () => {
    // Deterministic lane math: seed at settleNow - 120_000, cycleMs
    // 100_000 -> first due at settleNow - 20_000 settles, the surviving
    // successor is {start: settleNow - 20_000, completes: settleNow +
    // 80_000}. Device clock = BOUND - 80_000 - 1 makes
    // completes + shift land exactly at BOUND - 1.
    const settleNow = 1_000_000_000_000
    const lanes = settleWithClock(BOUND - 80_000 - 1)
    expect(lanes.length).toBeGreaterThan(0)
    const head = lanes.find((c) => c.completesAtMs === BOUND - 1)
    expect(head).toBeDefined()
    expect(head!.startedAtMs).toBe(BOUND - 1 - MORTAL_CYCLE_MS)
    expect(head!.completesAtMs - head!.startedAtMs).toBe(MORTAL_CYCLE_MS)
    expect(head!.startedAtMs).toBeGreaterThan(settleNow) // re-stamped into field epoch
  })

  it('completes + shift = 2^52: the seeded head keeps settle-epoch stamps (parked, in-domain)', () => {
    const settleNow = 1_000_000_000_000
    const lanes = settleWithClock(BOUND - 80_000)
    expect(lanes.length).toBeGreaterThan(0)
    // Skip arm: verbatim settle-epoch stamps - still inside [0, 2^52).
    for (const lane of lanes) {
      expect(lane.startedAtMs).toBe(settleNow - 20_000)
      expect(lane.completesAtMs).toBe(settleNow + 80_000)
      expect(lane.completesAtMs).toBeLessThan(BOUND)
    }
  })

  it('a skip leaves the seeded head in-domain forever - the parked stamps never reach the bound', () => {
    // Even under a huge shift the skipped stamps are the settle-epoch
    // ones minted under the headroom guard - always < 2^52.
    const lanes = settleWithClock(BOUND - 1)
    for (const lane of lanes) {
      expect(lane.startedAtMs).toBeLessThan(BOUND)
      expect(lane.completesAtMs).toBeLessThan(BOUND)
      expect(lane.completesAtMs).toBeGreaterThan(lane.startedAtMs)
    }
  })
})

// ----------------------------------------------------------------------------
// (D) cap clamps - claim VERIFIED at the bound; NaN arms noted.
// ----------------------------------------------------------------------------

describe('r33 COR - D: restore cap clamps at the domain edge', () => {
  it('DecomposeSystem.restore with restoreNow = 2^52 - 1 keeps nextCycleAt <= 2^52 - 1', () => {
    const bag = new MaterialBag()
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(4)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: BOUND - 1,
        started: true,
      },
      BOUND - 1,
    )
    // Cap = min(restoreNow + 30_000, 2^52-1) = 2^52-1; merged lands there.
    expect(system.getSaveState().nextCycleAt).toBe(BOUND - 1)
    expect(system.getSaveState().nextCycleAt).toBeLessThan(BOUND)
  })

  it('DecomposeSystem.restore deny-arm: restoreNow < 0 parks restoredDeadline verbatim', () => {
    const bag = new MaterialBag()
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(4)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: BOUND - 1,
        started: true,
      },
      -1,
    )
    // !clockOk -> Math.max(0, restoredDeadline) - verbatim park.
    expect(system.getSaveState().nextCycleAt).toBe(BOUND - 1)
  })

  it('Nit COR-F3: a NaN cycleMs (constructor-crafted option) propagates NaN into nextCycleAt', () => {
    // min(restoreNow + NaN, 2^52-1) = NaN -> merged = NaN -> nextCycleAt
    // NaN -> persisted NaN wedges the write gate. Reachable only through
    // a bad DecomposeSystemOptions - GameManager constructs with defaults
    // (30_000 constant), so this stays a code-defect note.
    const bag = new MaterialBag()
    const system = new DecomposeSystem(bag, { cycleSeconds: Number.NaN })
    system.updateCapacity(4)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs,
        started: true,
      },
      currentMs,
    )
    expect(Number.isNaN(system.getSaveState().nextCycleAt)).toBe(true)
  })

  it('TribulationDirector.restoreRuntime clamps cooldownUntil <= 2^52 - 1 at the bound', () => {
    const manager = registeredManager()
    manager.tribulationDirector.restoreRuntime(
      { cooldownUntil: BOUND - 1 },
      BOUND - 1,
    )
    const slice = manager.tribulationDirector.serializeRuntime()
    // cap = min(BOUND-1 + 300_000, 2^52-1) = 2^52-1 -> merged 2^52-1.
    expect(slice.cooldownUntil).toBe(BOUND - 1)
    expect(slice.cooldownUntil!).toBeLessThan(BOUND)
  })

  it('Nit COR-F4: a NaN cooldownUntil slice parks in-memory but serializeRuntime drops it (> 0 gate)', () => {
    const manager = registeredManager()
    manager.tribulationDirector.restoreRuntime(
      { cooldownUntil: Number.NaN },
      currentMs,
    )
    // Never persisted: slice.cooldownUntil is omitted when !(x > 0) -
    // no write-gate wedge. The live consequence is getCooldownSeconds
    // returning NaN - the crafted NaN opens the retry gate.
    const slice = manager.tribulationDirector.serializeRuntime()
    expect('cooldownUntil' in slice).toBe(false)
    expect(Number.isNaN(manager.tribulationDirector.getCooldownSeconds(currentMs))).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (E) applyTimedEffect - verified coercion table + residual nits.
// ----------------------------------------------------------------------------

describe('r33 COR - E: applyTimedEffect per-group ceiling + coercion arms', () => {
  it('TLT push clamps expiry at the writer bound now + 24h + 7d (not 2^52-1)', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.effectOps.applyTimedEffect(
      player,
      // Finite and above both the TLT bound and the magnitude domain -
      // the ceiling arm, not the non-finite dead-on-arrival arm.
      tltEffect({ expiresAtMs: 9_000_000_000_000_000 }),
    )
    const stored = player.persistentTimedEffects.find((e) => e.id === 'fx_tlt')!
    expect(stored.expiresAtMs).toBe(currentMs + TU_LINH_TRAN_DURATION_MS + 7 * 86_400_000)

    // The emitted record re-validates on the next write.
    const wire = JSON.parse(JSON.stringify(buildGameSave(player, manager))) as GameSave
    expect(validateGameSaveShape(wire).ok).toBe(true)
  })

  it('non-TLT (pill regen) push keeps the 2^52 - 1 domain ceiling', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    const source = regenSource()
    player.realmId = source.realmId as PlayerData['realmId']
    manager.effectOps.applyTimedEffect(player, {
      id: 'fx_pill',
      ...source.effect,
      appliedAtMs: currentMs,
      expiresAtMs: 9_000_000_000_000_000, // finite above the bound
    } as PersistentTimedEffect)
    const stored = player.persistentTimedEffects.find((e) => e.id === 'fx_pill')!
    expect(stored.expiresAtMs).toBe(BOUND - 1)
  })

  it.each([
    ['NaN applied', { appliedAtMs: Number.NaN }],
    ['+Inf applied', { appliedAtMs: Number.POSITIVE_INFINITY }],
    ['-Inf applied', { appliedAtMs: Number.NEGATIVE_INFINITY }],
  ])('push arm coerces %s to appliedCeiling = Date.now()', (_label, overrides) => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.effectOps.applyTimedEffect(
      player,
      tltEffect(overrides),
    )
    const stored = player.persistentTimedEffects.find((e) => e.id === 'fx_tlt')!
    expect(stored.appliedAtMs).toBe(currentMs)
  })

  it('push arm: NaN expires falls back to the applied stamp (dead on arrival)', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.effectOps.applyTimedEffect(
      player,
      tltEffect({ expiresAtMs: Number.NaN }),
    )
    const stored = player.persistentTimedEffects.find((e) => e.id === 'fx_tlt')!
    expect(stored.expiresAtMs).toBe(stored.appliedAtMs)
    expect(stored.expiresAtMs).toBe(currentMs)
  })

  it('stackable arm: NaN span coerces to 0 - no extension past max(now, existing)', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    const source = regenSource()
    player.realmId = source.realmId as PlayerData['realmId']
    // Existing live record, expires now + 60_000.
    player.persistentTimedEffects.push({
      id: 'fx_old',
      ...source.effect,
      appliedAtMs: currentMs - 30_000,
      expiresAtMs: currentMs + 60_000,
    } as PersistentTimedEffect)

    // Rebuy with NaN crafted stamps: rawSpan = expires - applied = NaN
    // -> duration 0 -> existing keeps max(now, existing).
    manager.effectOps.applyTimedEffect(player, {
      id: 'fx_new',
      ...source.effect,
      appliedAtMs: Number.NaN,
      expiresAtMs: Number.NaN,
    } as PersistentTimedEffect)

    const stored = player.persistentTimedEffects.find((e) => e.effectGroup === source.effect.effectGroup)!
    expect(stored.expiresAtMs).toBe(currentMs + 60_000)
  })

  it('stackable arm: -Inf span coerces to 0 (no shrink of a live expiry)', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    const source = regenSource()
    player.realmId = source.realmId as PlayerData['realmId']
    player.persistentTimedEffects.push({
      id: 'fx_old',
      ...source.effect,
      appliedAtMs: currentMs - 30_000,
      expiresAtMs: currentMs + 60_000,
    } as PersistentTimedEffect)

    manager.effectOps.applyTimedEffect(player, {
      id: 'fx_new',
      ...source.effect,
      appliedAtMs: currentMs,
      expiresAtMs: Number.NEGATIVE_INFINITY,
    } as PersistentTimedEffect)

    const stored = player.persistentTimedEffects.find((e) => e.effectGroup === source.effect.effectGroup)!
    // duration = max(0, rawSpan=-Inf -> not finite -> 0) -> max(now, existing).
    expect(stored.expiresAtMs).toBe(currentMs + 60_000)
  })

  it('non-stackable arm: claimedExpires NaN coerces to 0 - existing expiry preserved under max()', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    const source = regenSource()
    player.realmId = source.realmId as PlayerData['realmId']
    player.persistentTimedEffects.push({
      id: 'fx_old',
      sourceItemId: 'kiem_tam_dan', // any non-regen source lands in the non-stackable arm via stackable=false
      effectGroup: 'group_ns',
      durationStackable: false,
      appliedAtMs: currentMs - 30_000,
      expiresAtMs: currentMs + 60_000,
      modifiers: [],
    } as PersistentTimedEffect)

    manager.effectOps.applyTimedEffect(player, {
      id: 'fx_new',
      sourceItemId: 'kiem_tam_dan',
      effectGroup: 'group_ns',
      durationStackable: false,
      appliedAtMs: currentMs,
      expiresAtMs: Number.NaN,
      modifiers: [],
    } as PersistentTimedEffect)

    const stored = player.persistentTimedEffects.find((e) => e.effectGroup === 'group_ns')!
    // claimed = 0 -> max(existing, 0) = existing -> expiry survives.
    expect(stored.expiresAtMs).toBe(currentMs + 60_000)
  })

  it('Nit COR-F5: a non-finite EXISTING expiry propagates NaN through the merge arms', () => {
    // Live-state trust boundary: existing.expiresAtMs is not re-checked.
    // Math.max(now, NaN) = NaN -> min(ceiling, NaN) = NaN -> persisted
    // NaN wedges the write gate. Unreachable via a validated save (the
    // admission pin rejects non-finite stamps); only an in-memory defect
    // or ungated caller plants it - defense-in-depth gap, Nit.
    const manager = registeredManager()
    const player = createDefaultPlayer()
    const source = regenSource()
    player.realmId = source.realmId as PlayerData['realmId']
    player.persistentTimedEffects.push({
      id: 'fx_old',
      ...source.effect,
      appliedAtMs: currentMs - 30_000,
      expiresAtMs: Number.NaN, // planted non-finite live stamp
    } as PersistentTimedEffect)

    manager.effectOps.applyTimedEffect(player, {
      id: 'fx_new',
      ...source.effect,
      appliedAtMs: currentMs,
      expiresAtMs: currentMs + 5_000,
    } as PersistentTimedEffect)

    const stored = player.persistentTimedEffects.find((e) => e.effectGroup === source.effect.effectGroup)!
    expect(Number.isNaN(stored.expiresAtMs)).toBe(true)
  })

  it('Nit COR-F6: a pushed TLT record with expires < applied fails the ordering pin at next write', () => {
    // expires < applied lands verbatim in the pushed record - dead on
    // arrival (expires < now) but ordering-invalid for the TLT branch;
    // the write gate refuses until tickTimedEffects drops the record on
    // the same tick. Crafted-caller only: both real writers emit
    // expires > applied.
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.effectOps.applyTimedEffect(
      player,
      tltEffect({ appliedAtMs: currentMs, expiresAtMs: currentMs - 1 }),
    )
    const stored = player.persistentTimedEffects.find((e) => e.id === 'fx_tlt')!
    expect(stored.expiresAtMs).toBeLessThan(stored.appliedAtMs)

    const wire = JSON.parse(JSON.stringify(buildGameSave(player, manager))) as GameSave
    expect(validateGameSaveShape(wire).ok).toBe(false)

    // Transient: the same-tick drop self-heals the wedge.
    manager.effectOps.tickTimedEffects(player, currentMs)
    const wireAfter = JSON.parse(JSON.stringify(buildGameSave(player, manager))) as GameSave
    expect(validateGameSaveShape(wireAfter).ok).toBe(true)
  })

  it('Nit COR-F7: a ceiling-claimed TLT expiry + backward clock skew overshoots the provenance bound', () => {
    // expiresCeiling anchors at apply-time Date.now(); the write pin
    // anchors at lastSavedAt. Under a >0 backward jump before the save,
    // expires = applyNow + 24h + 7d > lastSavedAt + 24h + 7d -> refuse.
    // Narrow residual: needs the crafted max claim AND the skew.
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.effectOps.applyTimedEffect(
      player,
      tltEffect({ expiresAtMs: 1e18 }),
    )

    const wire = JSON.parse(JSON.stringify(buildGameSave(player, manager))) as GameSave
    // Simulate the clock having rolled back before this write.
    wire.player.lastSavedAt = currentMs - 1_000
    expect(validateGameSaveShape(wire).ok).toBe(false)

    // Control: monotone clock (lastSavedAt = applyNow) passes.
    const wireOk = JSON.parse(JSON.stringify(buildGameSave(player, manager))) as GameSave
    expect(validateGameSaveShape(wireOk).ok).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (F) bootGame resumeCombat - claim VERIFIED: reason-preserving, no-op on
//     stopped clock, sole-reason resume = the intended fix.
// ----------------------------------------------------------------------------

describe('r33 COR - F: resumeCombat(authority-pause) semantics (verified)', () => {
  it('resume deletes only the named reason - other freezes hold the clock', () => {
    const clock = new CombatClock(new ManualClockSource())
    clock.start()
    clock.freeze('authority-pause')
    clock.freeze('user-pause')
    clock.resume('authority-pause')
    expect(clock.getState()).toBe('frozen')
    expect(clock.getFreezeReasons()).toEqual(['user-pause'])
  })

  it('resume on a stopped clock is a true no-op', () => {
    const clock = new CombatClock(new ManualClockSource())
    expect(clock.getState()).toBe('stopped')
    clock.resume('authority-pause')
    expect(clock.getState()).toBe('stopped')
    expect(clock.getFreezeReasons()).toEqual([])
  })

  it('resume on a clock frozen only by authority-pause runs (the r32 fix path)', () => {
    const clock = new CombatClock(new ManualClockSource())
    clock.start()
    clock.freeze('authority-pause')
    expect(clock.getState()).toBe('frozen')
    clock.resume('authority-pause')
    expect(clock.getState()).toBe('running')
  })

  it('source pin: bootGame calls resumeCombat(authority-pause) after simPaused = false', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../composables/useAppLifecycle.ts', import.meta.url)),
      'utf-8',
    )
    const bootStart = source.indexOf('async function bootGame')
    const bootEnd = source.indexOf('// --- Essence stream state', bootStart)
    const bootBody = source.slice(bootStart, bootEnd)
    const flagIdx = bootBody.indexOf('simPaused = false')
    const resumeIdx = bootBody.indexOf("resumeCombat('authority-pause')")
    expect(flagIdx).toBeGreaterThanOrEqual(0)
    expect(resumeIdx).toBeGreaterThan(flagIdx)
  })
})

// ----------------------------------------------------------------------------
// (G) Boundary rows - domain edges on the restore seams.
// ----------------------------------------------------------------------------

describe('r33 COR - G: boundary rows', () => {
  it('restoreJobs boundary table: -1/-0/+0/2^52-1/2^52', () => {
    const manager = registeredManager()
    const recipe = mortalRecipe()
    const variant = recipe.herbVariants[0]!
    const mk = (jobId: string, startedAtMs: number, completesAtMs: number) =>
      alchemyJobFixture(
        {
          jobId,
          recipeId: recipe.id,
          pillId: recipe.pillId,
          herbMaterialId: variant.materialId,
          startedAtMs,
          completesAtMs,
          roomLevelAtStart: 1,
        },
        undefined,
        recipe,
      )

    // -0/+0 started stamps are in-domain (>= 0 passes `-0 < 0` false).
    manager.alchemySystem.restoreJobs(
      [mk('neg0', -0, 60_000), mk('pos0', 0, 60_000)] as never,
      currentMs,
    )
    expect(manager.alchemySystem.getJobs()).toHaveLength(2)

    // completes exactly at the bound drops (>= 2^52); bound - 1 keeps.
    manager.alchemySystem.restoreJobs(
      [mk('atbound', 1, BOUND), mk('inbound', 1, BOUND - 1)] as never,
      currentMs,
    )
    const jobs = manager.alchemySystem.getJobs()
    expect(jobs.find((j) => j.jobId === 'atbound')).toBeUndefined()
    expect(jobs.find((j) => j.jobId === 'inbound')).toBeDefined()
  })

  it('restoreStates boundary: in-domain post-dated max pair shifts in-domain', () => {
    const manager = registeredManager()
    // started = BOUND - 2, completes = BOUND - 1: ordered, in-domain,
    // post-dated (>> restoreNow). span = 1 -> shifted pair
    // {restoreNow, restoreNow + 1} - in-domain.
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(BOUND - 2, BOUND - 1)],
        },
      ] as never,
      currentMs,
    )
    const cycle = manager.productionSystem.getState(SITE_ID)!.workerCycles![0]!
    expect(cycle.startedAtMs).toBe(currentMs)
    expect(cycle.completesAtMs).toBe(currentMs + 1)
  })

  it('advanceWorkerLanes boundary: pending at 2^52 parks the whole site verbatim', () => {
    const result = advanceWorkerLanes(
      laneParams({ pending: [workerCycle(1, BOUND), workerCycle(1, 60_000)] }),
    )
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(2) // verbatim - no truncation
    expect(result.pending[1]!.completesAtMs).toBe(60_000)
  })
})
