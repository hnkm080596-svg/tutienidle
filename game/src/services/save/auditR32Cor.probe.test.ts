// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
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
import { alchemySecondsFor } from '../../core/alchemy/AlchemySystem'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { MaterialBag } from '../../core/material/MaterialBag'
import { PillBag } from '../../core/pill/PillBag'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import type { ProductionCycle } from '../../core/production/ProductionTypes'
import { buildProfessionMaterialId } from '../../core/profession/ProfessionMaterial'
import { TU_LINH_TRAN_DURATION_MS } from '../../core/economy/TuLinhTranBalance'

// ============================================================================
// QA probe - fixpoint r32 COR wave. Audits the r31 adjudication at 1d27aee4:
//
//   (A) Boundary truth table on the new [0, 2^52) persisted-stamp gates:
//       -1/-0/+0/2^52-1/2^52/NaN on workerCycles + alchemyJobs, validator
//       and both restore seams (drop vs park).
//   (B) Mint-headroom arithmetic at every guarded site: advanceWorkerLanes
//       nowMs/emptyLaneStartMs, AlchemySystem.startJob, DecomposeSystem
//       tick/settleOffline, and both restore shift arms.
//   (C) COR-F1 FINDING (Low): AlchemySystem.restoreJobs carries NO ordering
//       pin - an in-domain REVERSED pair (completesAtMs <= startedAtMs)
//       parks verbatim and settles (mints a pill) on the next honest tick;
//       a post-dated reversed pair additionally re-anchors through the
//       shift arm into a NEGATIVE completes (the headroom bounds only the
//       high side). The sibling advanceWorkerLanes denies the same class.
//       Ungated feed only: validateGameSaveShape pins ordering + span.
//   (D) COR-F2 FINDING (Low): advanceWorkerLanes' headroom guards
//       emptyLaneStartMs + cycleMs / nowMs + cycleMs, but the persisted
//       pending stamp is minted by buildProductionCycle as
//       startMs + computeCycleSeconds(baseSeconds, siteLevel) * 1000 - NOT
//       startMs + cycleMs. A caller passing a cycleMs smaller than the
//       authored span mints a completesAtMs the guard thought was inside
//       the domain. Both real callers pass the coherent pair
//       (cycleMs === computeCycleSeconds(...)*1000) so it stays latent.
//   (E) COR-F3 FINDING (Low): settleProductionOffline's field-epoch
//       re-stamp (ProductionOffline.ts:184-194) mints +fieldEpochShiftMs
//       with NO < 2^52 headroom - the one mint site in the batch's own
//       class left unguarded. Needs a device clock inside
//       [2^52 - cycleMs, 2^52) (epoch edge; lastSavedAt self-wedges a
//       cycleMs later anyway).
//   (F) COR-F4 (Nit): restoreJobs' shift-headroom arm is provably dead -
//       post-domain-drop, completesAtMs < 2^52 and startedAtMs > restoreNow
//       imply restoreNow + span < completesAtMs < 2^52, so the park arm it
//       was added for can never fire (the drop already handled that pair).
//       Harmless over-guard; noted so the sibling audit doesn't re-derive.
//   (G) applyTimedEffect push-arm clamp: appliedAtMs -> min(2^52-1, now).
//   (H) Honest-flow regression pins.
//
// ASCII only (P15).
// ============================================================================

let currentMs = 1_725_160_000_000

const BOUND = 2 ** 52
const SITE_ID = THANH_VAN_PRODUCTION_SITES[0]!.siteId
// The coherent cycleMs real callers compute for mortal / site level 1.
const MORTAL_CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM.mortal!, 1) * 1000

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

function mortalRecipe() {
  return alchemyRecipes.find((r) => r.id === 'alchemy_tu_linh_dan_mortal')!
}

function mortalJob(startedAtMs: number, jobId: string) {
  const recipe = mortalRecipe()
  const variant = recipe.herbVariants[0]!
  const span = alchemySecondsFor(recipe, 1) * 1000
  const job = alchemyJobFixture(
    {
      jobId,
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId: variant.materialId,
      startedAtMs,
      completesAtMs: startedAtMs + span,
      roomLevelAtStart: 1,
    },
    undefined,
    recipe,
  )
  return { job, recipe, span }
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
    baseSeconds: CYCLE_BASE_SECONDS_BY_REALM.mortal!,
    cycleMs: MORTAL_CYCLE_MS,
    pending: [] as ProductionCycle[],
    slots: 1,
    nowMs: currentMs,
    emptyLaneStartMs: currentMs,
    advanceMode: 'observe' as const,
    ...overrides,
  }
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
// (A) Boundary truth table on the new non-negative persisted-stamp domain.
// ----------------------------------------------------------------------------

describe('r32 COR - A: [0, 2^52) stamp gates - validator + mechanism parity', () => {
  it.each([
    ['started -1', { startedAtMs: -1, completesAtMs: 500 }],
    ['completes -1', { startedAtMs: 1, completesAtMs: -1 }],
    ['completes 2^52', { startedAtMs: 1, completesAtMs: BOUND }],
    ['started 2^52', { startedAtMs: BOUND, completesAtMs: BOUND + 1 }],
    ['reversed pair', { startedAtMs: 100, completesAtMs: 50 }],
    ['zero span', { startedAtMs: 100, completesAtMs: 100 }],
  ])('advanceWorkerLanes denies %s verbatim (zero advance)', (_label, stamps) => {
    const result = advanceWorkerLanes(
      laneParams({ pending: [workerCycle(stamps.startedAtMs, stamps.completesAtMs)] }),
    )
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toEqual([
      expect.objectContaining({
        startedAtMs: stamps.startedAtMs,
        completesAtMs: stamps.completesAtMs,
      }),
    ])
    expect(result.forfeited).toBe(0)
  })

  it.each([['-0 start', -0], ['+0 start', 0]])(
    'advanceWorkerLanes ADMITS %s - the tiny-past pair settles once (accepted residual)',
    (_label, startedAtMs) => {
      const result = advanceWorkerLanes(
        laneParams({ pending: [workerCycle(startedAtMs, 60_000)] }),
      )
      // Admitted and due -> completes exactly once (the documented
      // tiny-past mint residual, bounded to its own entry).
      expect(result.completed).toHaveLength(1)
      expect(result.completed[0]!.startedAtMs).toBe(startedAtMs)
    },
  )

  it('advanceWorkerLanes ADMITS completes = 2^52 - 1 (carried in-flight)', () => {
    const result = advanceWorkerLanes(
      laneParams({ pending: [workerCycle(1, BOUND - 1)] }),
    )
    expect(result.pending).toHaveLength(1)
    expect(result.pending[0]!.completesAtMs).toBe(BOUND - 1)
    expect(result.completed).toHaveLength(0)
  })

  it('validator pins both stamps non-negative on workerCycles', () => {
    const save = validWireSave()
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
        workerCycles: [workerCycle(-2_000_000, 10)],
      },
    ] as never
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    expect(shape.issues.some((i) => i.path.includes('workerCycles'))).toBe(true)
  })

  it('validator pins both stamps non-negative on alchemyJobs', () => {
    const save = validWireSave()
    save.buildings = [
      { instanceId: 'bld_1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 },
    ] as never
    const { job } = mortalJob(-500, 'neg')
    save.alchemyJobs = [{ ...job, completesAtMs: 100 }] as never
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    expect(shape.issues.some((i) => i.path.startsWith('alchemyJobs'))).toBe(true)
  })

  it('validator REFUSES the reversed alchemy pair upstream (why COR-F1 stays latent)', () => {
    const save = validWireSave()
    save.buildings = [
      { instanceId: 'bld_1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 },
    ] as never
    const { job } = mortalJob(100, 'reversed')
    save.alchemyJobs = [{ ...job, completesAtMs: 50 }] as never
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// (B) Mint-headroom arithmetic at every guarded mint site.
// ----------------------------------------------------------------------------

describe('r32 COR - B: headroom guards on clock + delta mints', () => {
  it.each([
    ['nowMs = 2^52 - cycleMs', BOUND - MORTAL_CYCLE_MS, false],
    ['nowMs = 2^52 - cycleMs - 1', BOUND - MORTAL_CYCLE_MS - 1, true],
    ['nowMs = 2^52 - 1', BOUND - 1, false],
  ])('advanceWorkerLanes %s', (_label, nowMs, admitted) => {
    const result = advanceWorkerLanes(
      laneParams({ nowMs, emptyLaneStartMs: nowMs }),
    )
    if (admitted) {
      // Headroom clear: the seeded due is minted inside the bound.
      expect(result.seededPending.length).toBe(1)
      expect(result.seededPending[0]!.completesAtMs).toBeLessThan(BOUND)
    } else {
      expect(result.completed).toHaveLength(0)
      expect(result.seededPending).toHaveLength(0)
      expect(result.pending).toHaveLength(0)
    }
  })

  it.each([
    ['emptyLaneStartMs = 2^52 - cycleMs', BOUND - MORTAL_CYCLE_MS, false],
    ['emptyLaneStartMs = 2^52 - cycleMs - 1', BOUND - MORTAL_CYCLE_MS - 1, true],
    ['emptyLaneStartMs = -1', -1, false],
    ['emptyLaneStartMs = NaN', Number.NaN, false],
    ['emptyLaneStartMs = +Infinity', Number.POSITIVE_INFINITY, false],
  ])('advanceWorkerLanes %s (WIN-ASYM arm)', (_label, start, admitted) => {
    const result = advanceWorkerLanes(laneParams({ emptyLaneStartMs: start }))
    if (admitted) {
      expect(result.seededPending.length).toBe(1)
    } else {
      expect(result.seededPending).toHaveLength(0)
      expect(result.pending).toHaveLength(0)
    }
  })

  function alchemyContext() {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    primeMortalCreationPick(player, manager.skillManager)
    const recipe = mortalRecipe()
    const variant = recipe.herbVariants[0]!
    const woodId = buildProfessionMaterialId('wood', recipe.fuelWoodRealmId, variant.age)
    const bag = manager.materialBag
    const registry = manager.materialRegistry
    bag.add(registry.get(variant.materialId), recipe.herbAmount)
    bag.add(registry.get(woodId), recipe.fuelWoodAmount)
    return { manager, recipe, variant, bag, registry }
  }

  it('startJob denies nowMs within span of the bound; admits at bound - span - 1', () => {
    const { manager, recipe, variant, bag, registry } = alchemyContext()
    const spanMs = alchemySecondsFor(recipe, 1) * 1000

    const denied = manager.alchemySystem.startJob(
      recipe, variant.materialId, bag, registry, 1_000_000, 1, BOUND - spanMs, 4,
    )
    expect(denied).toEqual({ ok: false, reason: 'invalid_clock' })

    // Boundary admit arm: the minted completes lands exactly at 2^52 - 1.
    const admitted = manager.alchemySystem.startJob(
      recipe, variant.materialId, bag, registry, 1_000_000, 1, BOUND - 1 - spanMs, 4,
    )
    expect(admitted.ok).toBe(true)
    expect(manager.alchemySystem.getJobs()[0]!.completesAtMs).toBe(BOUND - 1)
  })

  it('DecomposeSystem.tick headroom: nowMs within cycleMs of the bound zero-advances', () => {
    const bag = new MaterialBag()
    const ore = materials.find((m) => /_ore_/.test(m.id))!
    bag.add(ore, 10_000)
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(4)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: 0,
        started: false,
      },
      currentMs,
    )

    system.tick(BOUND - 1 - 30_000)
    expect(system.getSaveState().nextCycleAt).toBeGreaterThan(0)
    expect(system.getSaveState().nextCycleAt).toBeLessThan(BOUND)

    const system2 = new DecomposeSystem(new MaterialBag(), { cycleSeconds: 30 })
    system2.updateCapacity(4)
    system2.restore(
      { settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 }, nextCycleAt: 0, started: false },
      currentMs,
    )
    system2.tick(BOUND - 30_000)
    expect(system2.getSaveState().nextCycleAt).toBe(0)
  })

  it('DecomposeSystem.settleOffline headroom parity', () => {
    const bag = new MaterialBag()
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(4)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: 1_000,
        started: true,
      },
      currentMs,
    )
    expect(system.settleOffline(BOUND - 30_000, 0)).toBe(0)
  })
})

// ----------------------------------------------------------------------------
// (C) Drop-vs-park restore asymmetry + shift-arm reachability.
// ----------------------------------------------------------------------------

describe('r32 COR - C: restore seams - alchemy drops, production parks', () => {
  it('restoreJobs DROPS a negative pair and a >= 2^52 pair outright', () => {
    const manager = registeredManager()
    const { job: neg } = mortalJob(-500, 'neg')
    const { job: big } = mortalJob(BOUND - 1, 'big')
    manager.alchemySystem.restoreJobs(
      [neg, { ...big, completesAtMs: BOUND }] as never,
      currentMs,
    )
    expect(manager.alchemySystem.getJobs()).toHaveLength(0)
  })

  it('restoreStates PARKS a >= 2^52 lane verbatim - the deny lands in advanceWorkerLanes', () => {
    const manager = registeredManager()
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(1, BOUND)],
        },
      ] as never,
      currentMs,
    )
    const parked = manager.productionSystem.getState(SITE_ID)!.workerCycles!
    expect(parked).toHaveLength(1)
    expect(parked[0]!.completesAtMs).toBe(BOUND)

    const result = advanceWorkerLanes(laneParams({ pending: parked }))
    expect(result.completed).toHaveLength(0)
  })

  it('restoreJobs: a post-dated pair with completes >= 2^52 is DROPPED (never reaches the shift arm)', () => {
    const manager = registeredManager()
    // startedAtMs < 2^52 but completesAtMs >= 2^52: the domain drop runs
    // before the shift check - the headroom park arm is unreachable here
    // (see COR-F4).
    const { job } = mortalJob(BOUND - 500, 'postdate')
    manager.alchemySystem.restoreJobs([job] as never, BOUND - 100)
    expect(manager.alchemySystem.getJobs()).toHaveLength(0)
  })

  it('restoreJobs shift arm fires on an in-domain post-dated pair (re-anchored at restore clock)', () => {
    const manager = registeredManager()
    const { job, span } = mortalJob(currentMs + 10_000, 'postdate_ok')
    manager.alchemySystem.restoreJobs([job] as never, currentMs)
    const restored = manager.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(currentMs)
    expect(restored.completesAtMs).toBe(currentMs + span)
  })

  it('restoreStates shift arm: in-bound shifts; completes > 2^52 parks verbatim', () => {
    // Shift-fires arm.
    const manager = registeredManager()
    const span = MORTAL_CYCLE_MS
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(currentMs + 10_000, currentMs + 10_000 + span)],
        },
      ] as never,
      currentMs,
    )
    const shifted = manager.productionSystem.getState(SITE_ID)!.workerCycles![0]!
    expect(shifted.startedAtMs).toBe(currentMs)
    expect(shifted.completesAtMs).toBe(currentMs + span)

    // Deny arm is reachable on THIS seam (no domain drop): the source
    // pair's completes is already >= 2^52, so the shift would mint an
    // over-bound stamp - the headroom parks the original pair instead.
    const manager2 = registeredManager()
    manager2.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(BOUND - 500, BOUND - 500 + span)],
        },
      ] as never,
      BOUND - 100_000,
    )
    const parked = manager2.productionSystem.getState(SITE_ID)!.workerCycles![0]!
    expect(parked.startedAtMs).toBe(BOUND - 500)
    expect(parked.completesAtMs).toBe(BOUND - 500 + span)
  })
})

// ----------------------------------------------------------------------------
// (D) COR-F1: restoreJobs carries no ordering pin - an in-domain reversed
//     pair parks verbatim and mints on the next honest tick.
// ----------------------------------------------------------------------------

describe('r32 COR - D: COR-F1 - restoreJobs honors a reversed stamp pair (mechanism asymmetry)', () => {
  function reversedJob() {
    const recipe = mortalRecipe()
    return {
      recipe,
      job: alchemyJobFixture(
        {
          jobId: 'rev',
          recipeId: recipe.id,
          pillId: recipe.pillId,
          herbMaterialId: recipe.herbVariants[0]!.materialId,
          startedAtMs: 100,
          completesAtMs: 50,
          roomLevelAtStart: 1,
        },
        undefined,
        recipe,
      ),
    }
  }

  it('the reversed pair is DROPPED at the boundary (r32 fix - ordering parity)', () => {
    const manager = registeredManager()
    const { job } = reversedJob()
    manager.alchemySystem.restoreJobs([job] as never, currentMs)
    // r32-AUT-1/COR-F1: the flatMap now drops inverted pairs too
    // (completesAtMs <= startedAtMs) - impossible-authored content
    // never reaches the live queue.
    expect(manager.alchemySystem.getJobs()).toHaveLength(0)
  })

  it('the dropped reversed pair mints nothing on the next honest tick (r32 fix)', () => {
    const manager = registeredManager()
    const { job, recipe } = reversedJob()
    manager.alchemySystem.restoreJobs([job] as never, currentMs)

    const pillBag = new PillBag()
    manager.alchemySystem.tick(currentMs, pillBag, (pillId) => ({ id: pillId }), () => 0)

    expect(manager.alchemySystem.drainSettlementEvents()).toHaveLength(0)
    expect(manager.alchemySystem.getJobs()).toHaveLength(0)
    expect(pillBag.getAmount(recipe.pillId)).toBe(0)
  })

  it('contrast pin: the SAME reversed pair is denied at the worker-lane sibling', () => {
    const result = advanceWorkerLanes(
      laneParams({ pending: [workerCycle(100, 50)] }),
    )
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(1)
  })

  it('a reversed post-dated pair is DROPPED before the shift arm (r32 fix - no negative mint)', () => {
    const manager = registeredManager()
    const { job, recipe } = reversedJob()
    // started > restoreNow, completes < started: r32-AUT-2 drops the
    // pair outright - the shift can no longer mint a NEGATIVE completes
    // (the headroom only ever bounded the high side).
    const restoreNow = 500_000_000_000
    const reversed = alchemyJobFixture(
      {
        jobId: 'rev_shift',
        recipeId: recipe.id,
        pillId: recipe.pillId,
        herbMaterialId: recipe.herbVariants[0]!.materialId,
        startedAtMs: 1_000_000_000_100,
        completesAtMs: 500,
        roomLevelAtStart: 1,
      },
      undefined,
      recipe,
    )
    void job
    manager.alchemySystem.restoreJobs([reversed] as never, restoreNow)
    expect(manager.alchemySystem.getJobs()).toHaveLength(0)
  })
})

// ----------------------------------------------------------------------------
// (E) COR-F2: the persisted pending stamp is startMs + computeCycleSeconds,
//     not startMs + cycleMs - an incoherent (ungated) caller pair mints a
//     completesAtMs past the headroom the guard computed on cycleMs.
// ----------------------------------------------------------------------------

describe('r32 COR - E: COR-F2 - headroom denominates cycleMs, stamp uses computeCycleSeconds', () => {
  it('incoherent cycleMs < authored span: DENIED - headroom denominates the minted span (r32 fix)', () => {
    // Params real callers never produce: cycleMs (30_000) smaller than
    // computeCycleSeconds(100, 1) * 1000 (= MORTAL_CYCLE_MS = 100_000).
    // r32-COR-F2: the guard now bounds max(cycleMs, authored span), so
    // nowMs + 100_000 >= 2^52 denies the call outright - the minted
    // completesAtMs can no longer escape the persisted domain.
    const result = advanceWorkerLanes(
      laneParams({
        nowMs: BOUND - 60_000,
        emptyLaneStartMs: BOUND - 60_000,
        cycleMs: 30_000,
      }),
    )
    expect(result.seededPending.length).toBe(0)
    expect(result.pending).toHaveLength(0)
    expect(result.completed).toHaveLength(0)
  })

  it('control: the coherent pair keeps the minted completes inside the bound', () => {
    const result = advanceWorkerLanes(
      laneParams({
        nowMs: BOUND - MORTAL_CYCLE_MS - 1,
        emptyLaneStartMs: BOUND - MORTAL_CYCLE_MS - 1,
      }),
    )
    expect(result.seededPending.length).toBe(1)
    expect(result.seededPending[0]!.completesAtMs).toBeLessThan(BOUND)
  })
})

// ----------------------------------------------------------------------------
// (F) COR-F3: settleProductionOffline's field-epoch re-stamp mints
//     +fieldEpochShiftMs with no < 2^52 headroom.
// ----------------------------------------------------------------------------

describe('r32 COR - F: COR-F3 - seeded-head re-stamp has no < 2^52 headroom', () => {
  it('a device clock within cycleMs of the bound re-stamps a seeded head past the persisted domain', () => {
    const manager = registeredManager()
    const settleNow = 1_000_000_000_000 // authorized window end (server bound)
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

    // Device clock sits inside (2^52 - cycleMs, 2^52): the seeded head's
    // completes <= settleNow + cycleMs, then += (Date.now() - settleNow)
    // lands past the bound.
    vi.spyOn(Date, 'now').mockImplementation(() => BOUND - 1 - 15_000)

    manager.productionSystem.settleOffline(
      manager.materialBag,
      manager.materialRegistry,
      'mortal',
      settleNow,
      {
        workerCapacity: 4,
        offlineSinceMs: settleNow - 120_000,
        rng: () => 0.5,
      },
    )

    const lanes = manager.productionSystem.getState(SITE_ID)!.workerCycles!
    expect(lanes.length).toBeGreaterThan(0)
    // r32-AUT-4/COR-F3: the re-stamp is skipped when it would push the
    // head past 2^52 - the seeded head keeps its settle-epoch stamps
    // (parked, deny) instead of minting an out-of-domain deadline.
    expect(lanes.every((c) => c.completesAtMs < BOUND && c.startedAtMs < BOUND)).toBe(true)
  })

  it('control: an honest Date.now() re-stamps seeded heads in-domain', () => {
    const manager = registeredManager()
    const settleNow = currentMs - 5_000
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
    manager.productionSystem.settleOffline(
      manager.materialBag,
      manager.materialRegistry,
      'mortal',
      settleNow,
      {
        workerCapacity: 4,
        offlineSinceMs: settleNow - 120_000,
        rng: () => 0.5,
      },
    )
    const lanes = manager.productionSystem.getState(SITE_ID)!.workerCycles!
    for (const lane of lanes) {
      expect(lane.startedAtMs).toBeGreaterThanOrEqual(0)
      expect(lane.startedAtMs).toBeLessThan(BOUND)
      expect(lane.completesAtMs).toBeGreaterThanOrEqual(0)
      expect(lane.completesAtMs).toBeLessThan(BOUND)
    }
  })
})

// ----------------------------------------------------------------------------
// (G) applyTimedEffect push-arm clamp.
// ----------------------------------------------------------------------------

describe('r32 COR - G: applyTimedEffect appliedAtMs clamp', () => {
  function baseEffect(overrides: Record<string, unknown> = {}) {
    return {
      id: 'eff_probe',
      sourceItemId: 'tu_linh_tran',
      appliedAtMs: currentMs,
      expiresAtMs: currentMs + 86_400_000,
      modifiers: [],
      effectGroup: 'tu_linh_tran',
      cultivationSpeedPercent: 0.25,
      durationStackable: false,
      ...overrides,
    }
  }

  it('appliedAtMs clamps to min(2^52-1, Date.now()) - a huge value lands at now', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    primeMortalCreationPick(player, manager.skillManager)

    manager.effectOps.applyTimedEffect(player, baseEffect({ appliedAtMs: 1e16 }) as never)
    const stored = player.persistentTimedEffects.find((e) => e.id === 'eff_probe')!
    expect(stored.appliedAtMs).toBe(currentMs)

    const shape = validateGameSaveShape(
      JSON.parse(JSON.stringify(buildGameSave(player, manager))) as GameSave,
    )
    expect(shape.ok).toBe(true)
  })

  it('expiresAtMs reaches the TLT writer bound, not the bare bound (r32 fix) - pushed record validates', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    primeMortalCreationPick(player, manager.skillManager)

    manager.effectOps.applyTimedEffect(player, baseEffect({ expiresAtMs: 1e16 }) as never)
    const stored = player.persistentTimedEffects.find((e) => e.id === 'eff_probe')!
    // r32-INT-2: a TLT push ceilings at the validator's own writer bound
    // (lastSavedAt + 24h + 7d), not 2^52-1 - the emitted stamp
    // re-validates on the next write.
    expect(stored.expiresAtMs).toBe(currentMs + TU_LINH_TRAN_DURATION_MS + 7 * 86_400_000)

    const shape = validateGameSaveShape(
      JSON.parse(JSON.stringify(buildGameSave(player, manager))) as GameSave,
    )
    expect(shape.ok).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (H) Honest-flow regression pins.
// ----------------------------------------------------------------------------

describe('r32 COR - H: honest flow still works end to end', () => {
  it('an honest in-flight workerCycles pair restores + settles under budget', () => {
    const manager = registeredManager()
    const started = currentMs - MORTAL_CYCLE_MS - 1_000
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(started, started + MORTAL_CYCLE_MS)],
        },
      ] as never,
      currentMs,
    )
    const bag = manager.materialBag
    const settled = manager.productionSystem.settleOffline(
      bag,
      manager.materialRegistry,
      'mortal',
      currentMs,
      { workerCapacity: 4, offlineSinceMs: started, rng: () => 0.5 },
    )
    expect(settled).toBeGreaterThanOrEqual(1)
  })

  it('an honest in-flight alchemy job restores + settles a pill', () => {
    const manager = registeredManager()
    const { job, span, recipe } = mortalJob(currentMs - 600_000, 'honest')
    manager.alchemySystem.restoreJobs([job] as never, currentMs - 60_000)
    void span
    const pillBag = new PillBag()
    manager.alchemySystem.tick(currentMs, pillBag, (pillId) => ({ id: pillId }), () => 0)
    const events = manager.alchemySystem.drainSettlementEvents()
    expect(events.length).toBe(1)
    expect(events[0]!.success).toBe(true)
    expect(pillBag.getAmount(recipe.pillId)).toBeGreaterThan(0)
  })
})
