// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameManager as GameManagerType } from '../../core/game/GameManager'
import { ManualClockSource } from '../../core/battle/turn/CombatClock'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { useAppLifecycle } from '../../composables/useAppLifecycle'
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
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import type { ProductionCycle } from '../../core/production/ProductionTypes'
import { CYCLE_BASE_SECONDS_BY_REALM, computeCycleSeconds } from '../../core/production/ProductionBalance'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { TribulationDirector } from '../../core/tribulation/TribulationDirector'
import { EventBus } from '../../core/events/EventBus'

// ============================================================================
// QA probe - fixpoint r33 AUT wave. Adversarial audit of the r32 adjudication
// at a014b7fb:
//
//   (A/B) useAppLifecycle.bootGame resumeCombat('authority-pause') at :355 -
//         the reason is released BEFORE the boot outcome is known. On every
//         failure branch a battle latched only under 'authority-pause' flips
//         to 'running' behind the terminal card, and on the success path the
//         clock steps across the coordinator.load() await on pre-restore
//         state.
//   (C)   CombatClock reason hygiene controls: resume deletes only the named
//         reason; a 'stopped' clock cannot be resumed; user-pause survives.
//   (D)   ProductionSystem.restoreStates parks invalid pairs verbatim - one
//         crafted inverted cycle freezes the WHOLE site advance (pending.some
//         guard) AND rides to the wire so every later write refuses. Sibling
//         AlchemySystem.restoreJobs drops the identical shape - asymmetry.
//   (E)   WorkerLaneAdvance mintedSpanMs denominator: boundary probes pin that
//         the max(cycleMs, authored) switch denominates whichever stamp is
//         larger - an incoherent cycleMs either direction cannot mint past
//         nowMs + mintedSpanMs.
//   (F)   Decompose/Tribulation cap clamps at restoreNow = 2^52-1: the minted
//         cap itself lands in-domain.
//   (G)   ProductionOffline re-stamp skip arm reachability: seededPending is
//         empty near the bound - the skip arm can never receive input.
//
// ASCII only (P15).
// ============================================================================

let currentMs = 1_725_160_000_000

const DOMAIN_TOP = 2 ** 52

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

function mortalRecipe() {
  return alchemyRecipes.find((r) => r.id === 'alchemy_tu_linh_dan_mortal')!
}

function lifecycleStubs() {
  const intervals: Array<() => void> = []
  return {
    intervals,
    clock: { start: vi.fn(), stop: vi.fn(), nowSeconds: () => 0 },
    scheduleInterval: (cb: () => void) => (intervals.push(cb), intervals.length),
    clearHandle: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    boot: {
      startSaveLoad: vi.fn(),
      startInitializing: vi.fn(),
      enterGame: vi.fn(),
      fail: vi.fn(),
      requireCharacter: vi.fn(),
      showAuth: vi.fn(),
    },
    coordinator: {
      load: vi.fn(async () => ({ status: 'empty' as const, revision: 0 as const })) as {
        (data?: unknown): Promise<Record<string, unknown>>
      },
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      reset: vi.fn(),
      capability: 'local-only' as const,
    },
    player: { save: vi.fn(), restoreFromSave: vi.fn(), $state: {} },
    authority: {
      canMutate: vi.fn(() => true),
      beginChecking: vi.fn(),
      markReady: vi.fn(),
      markFailed: vi.fn(),
      observeSaveResult: vi.fn(),
    },
    tick: vi.fn(),
    gameManager: {
      eventBus: { on: vi.fn(), off: vi.fn() },
    } as unknown as GameManagerType,
    offlineSummary: { show: vi.fn() },
    saveIssue: { report: vi.fn() },
    entryStage: ref('game'),
    restoreGameSession: vi.fn(() => ({ status: 'ok' })),
    persistPlayer: vi.fn(async () => ({ status: 'ok', revision: 1 })),
    onError: vi.fn(),
    unsupportedSaveNotice: vi.fn(),
    hardReset: vi.fn(),
  }
}

const SITE_ID = THANH_VAN_PRODUCTION_SITES[0]!.siteId

function siteStateWith(cycles: ProductionCycle[]) {
  return {
    siteId: SITE_ID,
    level: 1,
    autoRestart: true,
    activeWorkerSlots: 1,
    workerCycles: cycles,
  }
}

function workerCycle(cycleId: string, startedAtMs: number, completesAtMs: number): ProductionCycle {
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

beforeEach(() => {
  setActivePinia(createPinia())
  currentMs = 1_725_160_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------------------
// (A/B) bootGame resumeCombat('authority-pause') - post-admission placement
// ----------------------------------------------------------------------------

describe('r33 AUT - A/B: bootGame keeps the combat freeze latched until admission is proven', () => {
  it('failed boot: the latched battle stays FROZEN behind the error card - the reason only clears after markReady', async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)
    startAStage(manager)

    // The latch pauseSimulation writes during a terminal authority pause.
    manager.freezeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'unavailable' as const,
      message: 'down',
      retryable: true,
    }))
    // boot.fail() in the real flow moves entryStage to 'error'.
    stubs.boot.fail = vi.fn(() => {
      stubs.entryStage.value = 'error'
    })
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)

    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('failed')
    // The unlatch runs only after authority.markReady() - admission was
    // never granted, so the reason survives and the terminal card mounts
    // over a still-FROZEN clock.
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')

    // pauseSimulation still early-returns while entryStage !== 'game' -
    // and now nothing needs re-latching: the latch never opened.
    lifecycle.pauseSimulation()
    expect(manager.getCombatClockState()).toBe('frozen')

    // The clock's own source keeps firing but no step is emitted - the
    // battle cannot count behind the terminal surface.
    combatSource.advance(1)
    expect(manager.getElapsedCombatSteps()).toBe(0)

    lifecycle.stopAll()
  })

  it('successful boot: the clock stays frozen across the load await, then unlatches post-admission', async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)
    startAStage(manager)
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'

    const writer = registeredManager()
    const player = createDefaultPlayer()
    writer.setActivePlayer(player)
    primeMortalCreationPick(player, writer.skillManager)
    const save = JSON.parse(JSON.stringify(buildGameSave(player, writer)))

    // A combat source firing mid-load is the RAF/MainProcess frame that can
    // land anywhere inside the await - deterministic equivalent.
    stubs.coordinator.load = vi.fn(async () => {
      combatSource.advance(0.5)
      return { status: 'ok' as const, save, revision: 1 }
    })
    stubs.boot.enterGame = vi.fn(() => {
      stubs.entryStage.value = 'game'
    })
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)

    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('entered')
    // The frame inside the load window could not step the battle - the
    // latch held until markReady - and the successful boot then cleared
    // the reason (the r32-INT-1 intent still holds).
    expect(manager.getElapsedCombatSteps()).toBe(0)
    expect(manager.getFreezeReasons()).not.toContain('authority-pause')
    expect(manager.getCombatClockState()).toBe('running')

    lifecycle.stopAll()
  })
})

// ----------------------------------------------------------------------------
// (C) CombatClock reason hygiene controls for the resumeCombat claim
// ----------------------------------------------------------------------------

describe('r33 AUT - C: resumeCombat reason hygiene', () => {
  it('resume deletes ONLY the named reason - user-pause survives bootGame resume', () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)

    manager.freezeCombat('user-pause')
    manager.resumeCombat('authority-pause')

    expect(manager.getFreezeReasons()).toContain('user-pause')
    expect(manager.getCombatClockState()).toBe('frozen')
  })

  it('resume cannot unstop a stopped clock', () => {
    const manager = registeredManager()
    expect(manager.getCombatClockState()).toBe('stopped')

    manager.resumeCombat('authority-pause')

    expect(manager.getCombatClockState()).toBe('stopped')
  })

  it('a battle frozen ONLY by authority-pause resumes to running (the intended fix)', () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)

    manager.freezeCombat('authority-pause')
    manager.resumeCombat('authority-pause')

    expect(manager.getCombatClockState()).toBe('running')
  })
})

// ----------------------------------------------------------------------------
// (D) restoreStates drops the inverted workerCycle -> site self-heals
// ----------------------------------------------------------------------------

describe('r33 AUT - D: restoreStates drops the inverted pair at the boundary', () => {
  it('the inverted pair never reaches live state; the honest due lane settles normally', () => {
    const manager = registeredManager()
    const inverted = workerCycle('bad', currentMs - 30_000, currentMs - 60_000) // completes < started
    const due = workerCycle('good', currentMs - 120_000, currentMs - 10_000) // honest, due

    manager.productionSystem.restoreStates(
      [siteStateWith([inverted, due])],
      currentMs,
    )

    const parked = manager.productionSystem.getState(SITE_ID)!.workerCycles!
    expect(parked.map((c) => c.cycleId)).toEqual(['good'])

    const bag = new MaterialBag()
    const registry = new MaterialRegistry()
    materials.forEach((m) => registry.register(m))

    // With the poison gone the advance runs free: the honest DUE lane
    // settles (observe mode discharges it; the refill lands next tick).
    manager.productionSystem.tickWorkers(
      currentMs + 10_000_000,
      bag,
      registry,
      'mortal',
      1,
    )

    const after = manager.productionSystem.getState(SITE_ID)!.workerCycles!
    expect(after.some((c) => c.cycleId === 'good')).toBe(false)
  })

  it('control: an honest due lane on a clean site DOES settle', () => {
    const manager = registeredManager()
    const due = workerCycle('good', currentMs - 120_000, currentMs - 10_000)

    manager.productionSystem.restoreStates([siteStateWith([due])], currentMs)

    const bag = new MaterialBag()
    const registry = new MaterialRegistry()
    materials.forEach((m) => registry.register(m))

    manager.productionSystem.tickWorkers(
      currentMs + 10_000_000,
      bag,
      registry,
      'mortal',
      1,
    )

    // The due lane completed and was removed from pending (refill lands on
    // the next tick - observe mode).
    expect(
      manager.productionSystem.getState(SITE_ID)!.workerCycles!.some((c) => c.cycleId === 'good'),
    ).toBe(false)
  })

  it('the dropped inverted pair cannot reach the wire - every subsequent write validates', () => {
    const manager = registeredManager()
    const inverted = workerCycle('bad', currentMs - 30_000, currentMs - 60_000)

    manager.productionSystem.restoreStates(
      [siteStateWith([inverted])],
      currentMs,
    )

    // Gone from live state -> nothing ordering-invalid can persist.
    expect(manager.productionSystem.getState(SITE_ID)!.workerCycles!).toHaveLength(0)

    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    primeMortalCreationPick(player, manager.skillManager)

    const save = JSON.parse(JSON.stringify(buildGameSave(player, manager)))
    const shape = validateGameSaveShape(save)

    // The ordering pin never sees it - the write gate stays open
    // (self-heal instead of a permanent SAVE_INVALID wedge).
    expect(shape.ok).toBe(true)
  })

  it('sibling asymmetry: restoreJobs DROPS the identical inverted shape (self-heals)', () => {
    const reader = registeredManager()
    const recipe = mortalRecipe()
    const span = alchemySecondsFor(recipe, 1) * 1000
    const started = currentMs - 60_000
    const invertedJob = alchemyJobFixture(
      {
        jobId: 'r33_inv',
        recipeId: recipe.id,
        pillId: recipe.pillId,
        herbMaterialId: recipe.herbVariants[0]!.materialId,
        startedAtMs: started,
        completesAtMs: started - span, // inverted
        roomLevelAtStart: 1,
      },
      undefined,
      recipe,
    )

    reader.alchemySystem.restoreJobs([invertedJob], currentMs)

    expect(reader.alchemySystem.getJobs()).toHaveLength(0)
  })
})

// ----------------------------------------------------------------------------
// (E) mintedSpanMs denominator - the max() covers both incoherent directions
// ----------------------------------------------------------------------------

describe('r33 AUT - E: advanceWorkerLanes mintedSpanMs boundary', () => {
  const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM['mortal']!
  const authoredMs = computeCycleSeconds(baseSeconds, 1) * 1000

  it('incoherent cycleMs < authored span: minted stamps still stay in-domain up to the authored bound', () => {
    const nowMs = DOMAIN_TOP - authoredMs - 1
    const result = advanceWorkerLanes({
      siteId: SITE_ID,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds,
      cycleMs: 1000, // caller claims a 1s cycle while the authored span is huge
      pending: [],
      slots: 1,
      nowMs,
      // Due uses the caller's cycleMs (seed due = start + 1000 > nowMs) so
      // the lane parks - the PERSISTED stamp carries the authored span.
      emptyLaneStartMs: nowMs - 500,
      advanceMode: 'observe',
    })

    // The minted pending carries the AUTHORED span, not cycleMs - the guard
    // allowed it only because nowMs + authored < 2^52 still holds.
    expect(result.pending).toHaveLength(1)
    expect(result.pending[0]!.completesAtMs - result.pending[0]!.startedAtMs).toBe(authoredMs)
    expect(result.pending[0]!.completesAtMs).toBeLessThan(DOMAIN_TOP)
  })

  it('incoherent cycleMs < authored span: seeded dues complete INSTANTLY - a caller-contract mint', () => {
    // cycleMs=1 makes every seeded lane's due = startMs + 1ms <= nowMs, so
    // the seed walks a completion per lane per call while the minted cycle
    // still claims the full authored span/reward. Both live callers pass
    // the coherent pair - this pins the mechanism, not a live defect.
    const result = advanceWorkerLanes({
      siteId: SITE_ID,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds,
      cycleMs: 1,
      pending: [],
      slots: 2,
      nowMs: currentMs,
      emptyLaneStartMs: currentMs - 1000,
      advanceMode: 'observe',
    })

    expect(result.completed).toHaveLength(2)
    expect(
      result.completed.every((c) => c.completesAtMs - c.startedAtMs === authoredMs),
    ).toBe(true)
  })

  it('incoherent cycleMs < authored span: at nowMs + authored >= 2^52 the advance DENIES (no out-of-domain mint)', () => {
    const nowMs = DOMAIN_TOP - authoredMs + 1
    const result = advanceWorkerLanes({
      siteId: SITE_ID,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds,
      cycleMs: 1,
      pending: [],
      slots: 1,
      nowMs,
      emptyLaneStartMs: nowMs - 1000,
      advanceMode: 'observe',
    })

    expect(result.pending).toHaveLength(0)
    expect(result.completed).toHaveLength(0)
  })

  it('incoherent cycleMs > authored span: the LARGER cycleMs denominates (deny one step early)', () => {
    const cycleMs = authoredMs * 4
    const nowMs = DOMAIN_TOP - cycleMs + 1
    const result = advanceWorkerLanes({
      siteId: SITE_ID,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds,
      cycleMs,
      pending: [],
      slots: 1,
      nowMs,
      emptyLaneStartMs: nowMs - 1000,
      advanceMode: 'observe',
    })

    expect(result.pending).toHaveLength(0)
  })
})

// ----------------------------------------------------------------------------
// (F) cap clamps - minted cap stays in-domain at the clock edge
// ----------------------------------------------------------------------------

describe('r33 AUT - F: restore cap clamps stay in-domain at restoreNow = 2^52 - 1', () => {
  it('DecomposeSystem.restore: merged deadline clamps to 2^52-1, never past it', () => {
    const bag = new MaterialBag()
    const decompose = new DecomposeSystem(bag, { cycleSeconds: 60 })

    // Restored stamp above the domain: the clamp pulls it to the cap
    // (min(restoreNow + cycleMs, 2^52 - 1)) instead of parking >= 2^52.
    decompose.restore(
      { settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 }, nextCycleAt: DOMAIN_TOP + 1, started: true },
      DOMAIN_TOP - 1,
    )

    const saved = decompose.getSaveState()
    expect(saved.nextCycleAt).toBe(DOMAIN_TOP - 1)
    expect(saved.nextCycleAt).toBeLessThan(DOMAIN_TOP)
  })

  it('TribulationDirector.restoreRuntime: cooldownUntil clamps to 2^52-1, never past it', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })

    director.restoreRuntime({ cooldownUntil: DOMAIN_TOP + 1 }, DOMAIN_TOP - 1)

    expect(director.serializeRuntime().cooldownUntil).toBe(DOMAIN_TOP - 1)
  })
})

// ----------------------------------------------------------------------------
// (G) re-stamp skip arm - no reachable input near the bound
// ----------------------------------------------------------------------------

describe('r33 AUT - G: ProductionOffline re-stamp skip arm is unreachable', () => {
  it('the only feeders (seededPending) cannot exist within span of the bound - advance denies first', () => {
    const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM['mortal']!
    const authoredMs = computeCycleSeconds(baseSeconds, 1) * 1000
    const nowMs = DOMAIN_TOP - authoredMs + 1 // inside mintedSpan of the bound

    const result = advanceWorkerLanes({
      siteId: SITE_ID,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds,
      cycleMs: authoredMs,
      pending: [],
      slots: 2,
      nowMs,
      emptyLaneStartMs: nowMs - 3_600_000,
      advanceMode: 'deadline',
      budgetMs: 10_000_000,
    })

    // Deny: no seeds exist to re-stamp. Below this clock, every seeded head
    // carries completesAtMs <= nowMs + authoredMs, so the skip arm needs
    // fieldEpochShiftMs >= 2^52 - completes i.e. Date.now() at ~2^52 - dead.
    expect(result.seededPending).toHaveLength(0)
    expect(result.pending).toHaveLength(0)
  })
})
