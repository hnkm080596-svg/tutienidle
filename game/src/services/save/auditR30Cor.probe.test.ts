// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
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
import {
  alchemyJobReservationDigest,
  alchemySecondsFor,
  verifyAlchemyJobReservation,
} from '../../core/alchemy/AlchemySystem'
import { EventBus } from '../../core/events/EventBus'
import { TribulationDirector } from '../../core/tribulation/TribulationDirector'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { MaterialBag } from '../../core/material/MaterialBag'
import { QuestManager } from '../../core/quest/QuestManager'
import { PillBag } from '../../core/pill/PillBag'
import { useAppLifecycle } from '../../composables/useAppLifecycle'
import { useBootFlow } from '../../composables/useBootFlow'
import { OnlineSessionController } from '../session/OnlineSessionController'
import { EquipmentBag, EQUIPMENT_PROTECTION_CAP } from '../../core/equipment/EquipmentBag'
import { makeInstance as makeEquipmentInstance } from '../../core/equipment/EquipmentInstance.fixture'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import { buildProfessionMaterialId } from '../../core/profession/ProfessionMaterial'
import type { GameManager as GameManagerType } from '../../core/game/GameManager'

// ============================================================================
// QA probe - fixpoint r30 COR wave. Audits the r29 adjudication at 33ade943:
//
//   (A) AlchemySystem.restoreJobs clockOk truth table: verbatim restore under
//       every deny clock (NaN / +-Infinity / +-2^53 / 1e300); shift arm under
//       admitted boundary clocks ([0, 2^52) domain) with exact span preservation
//       and re-derived reservation digest.
//   (B) ProductionSystem.restoreStates same truth table on workerCycle pairs.
//   (C) DecomposeSystem tick/restore/settleOffline at the remaining edges
//       (+-2^53, -Infinity) the r29 probe left unpinned.
//   (D) QuestManager.restore lastDailyResetAtMs: verbatim under deny clocks,
//       min(stamp, now) under a sane clock, 0 on non-finite input.
//   (E) TribulationDirector.restoreRuntime: verbatim under deny clocks,
//       min(slice, now + 300s) under a sane clock.
//   (F) AlchemySystem.startJob invalid_clock origination gate: exact reason,
//       zero burn, precedence over scope_hidden, in-domain boundary still runs.
//   (G) useAppLifecycle tick callback: entryStage x canMutate truth table
//       (only 'game' + mutable ticks) plus the autosave persistProgress gate.
//   (H) OnlineSessionController substrate for the lifecycle claim: under
//       LOCAL authority (no reconnect dep) a coded refuse leaves canMutate()
//       true - the entryStage gate is load-bearing; under remote it is
//       'recovery' terminal.
//   (I) useBootFlow stage derivation truth table + fail() retry bound.
//   (J) saveShapeValidation cap boundaries: requireArray/optionalArray at
//       1024/1025, equipment protection cap at 10/11 (union pool parity
//       with EquipmentBag), nodeLevels root cap still refuses over-cap.
//   (K) sibling-gap probes: cap-skipped collections still walked via raw
//       field reads (selectedTalentIds :3151, persistentTimedEffects :887),
//       and applyTimedEffect's non-stackable merge + verbatim push lack the
//       2^52 clamp the stackable arm has (self-brick wedge).
//   (L) honest-shape regression pins.
//
// ASCII only (P15).
// ============================================================================

let currentMs = 1_725_160_000_000

const DENY_CLOCKS = [
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  -1,
  -(2 ** 52),
  2 ** 52,
  2 ** 53,
  -(2 ** 53),
  1e300,
  -1e300,
]

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

const ANY_PILL = () => new PillBag()
const RESOLVE_ANY = (pillId: string) => ({ id: pillId })

beforeEach(() => {
  setActivePinia(createPinia())
  currentMs = 1_725_160_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------------------
// (A) restoreJobs clockOk truth table
// ----------------------------------------------------------------------------

describe('r30 COR - A: restoreJobs clockOk truth table', () => {
  it.each(DENY_CLOCKS)(
    'restoreNowMs=%j: post-dated job restores VERBATIM (stamps+digest untouched) and stays parked',
    (edge) => {
      const { job, span } = mortalJob(currentMs + 60_000, `r30a_${String(edge)}`)
      const writerDigest = job.reservation!.digest
      const reader = registeredManager()

      reader.alchemySystem.restoreJobs([job], edge)
      const restored = reader.alchemySystem.getJobs()[0]!

      expect(restored.startedAtMs).toBe(currentMs + 60_000)
      expect(restored.completesAtMs).toBe(currentMs + 60_000 + span)
      expect(restored.reservation!.digest).toBe(writerDigest)

      // Deny direction: the next honest tick parks it (not due yet).
      reader.alchemySystem.tick(currentMs, ANY_PILL(), RESOLVE_ANY)
      expect(reader.alchemySystem.getJobs()).toHaveLength(1)
    },
  )

  it.each([0, currentMs])(
    'restoreNowMs=%j admitted: post-dated job SHIFTS - re-grounds at restoreNowMs, span preserved, digest re-derived consistent',
    (edge) => {
      const { job, span } = mortalJob(currentMs + 60_000, `r30a_admit_${String(edge)}`)
      const writerDigest = job.reservation!.digest
      const reader = registeredManager()

      reader.alchemySystem.restoreJobs([job], edge)
      const restored = reader.alchemySystem.getJobs()[0]!

      // Grounding is exact at these admit edges (0 and an epoch-ms
      // clock); span and digest consistency are the pinned invariant.
      expect(Math.abs(restored.startedAtMs - edge)).toBeLessThanOrEqual(4)
      expect(restored.completesAtMs - restored.startedAtMs).toBe(span)
      expect(restored.reservation!.digest).not.toBe(writerDigest)
      expect(restored.reservation!.digest).toBe(
        alchemyJobReservationDigest(restored, restored.reservation!),
      )
      expect(verifyAlchemyJobReservation(restored, mortalRecipe())).toBeNull()
    },
  )

  it.each([2 ** 52, 2 ** 53 - 1])(
    'deny boundary %j: out-of-domain clock leaves the pair verbatim',
    (edge) => {
      const { job, span } = mortalJob(currentMs + 60_000, `r30a_top_${edge}`)
      const reader = registeredManager()

      reader.alchemySystem.restoreJobs([job], edge)
      const restored = reader.alchemySystem.getJobs()[0]!

      // Out-of-domain clock -> verbatim stamps (deny, never re-anchor).
      expect(restored.startedAtMs).toBe(currentMs + 60_000)
      expect(restored.completesAtMs).toBe(currentMs + 60_000 + span)
    },
  )
})

// ----------------------------------------------------------------------------
// (B) restoreStates clockOk truth table on workerCycle pairs
// ----------------------------------------------------------------------------

describe('r30 COR - B: restoreStates workerCycle clockOk truth table', () => {
  const SITE_ID = THANH_VAN_PRODUCTION_SITES[0]!.siteId

  function siteState(startedAtMs: number, completesAtMs: number) {
    return {
      siteId: SITE_ID,
      level: 1,
      autoRestart: true,
      activeWorkerSlots: 1,
      workerCycles: [
        {
          cycleId: 'cyc_probe',
          siteId: SITE_ID,
          collectionRealmId: 'mortal',
          siteLevelAtStart: 1,
          rewardTableVersion: 1,
          rollSeed: 1,
          startedAtMs,
          completesAtMs,
        },
      ],
    }
  }

  it.each(DENY_CLOCKS)(
    'restoreNowMs=%j: post-dated workerCycle restores VERBATIM',
    (edge) => {
      const manager = registeredManager()
      const started = currentMs + 60_000
      const completes = started + 30_000

      manager.productionSystem.restoreStates([siteState(started, completes)], edge)

      const restored = manager.productionSystem.getState(SITE_ID)!.workerCycles![0]!
      expect(restored.startedAtMs).toBe(started)
      expect(restored.completesAtMs).toBe(completes)
    },
  )

  it.each([0, currentMs])(
    'restoreNowMs=%j admitted: post-dated workerCycle SHIFTS - grounds at restoreNowMs within double precision, span preserved',
    (edge) => {
      const manager = registeredManager()
      const started = currentMs + 60_000
      const completes = started + 30_000

      manager.productionSystem.restoreStates([siteState(started, completes)], edge)

      const restored = manager.productionSystem.getState(SITE_ID)!.workerCycles![0]!
      expect(Math.abs(restored.startedAtMs - edge)).toBeLessThanOrEqual(4)
      expect(restored.completesAtMs - restored.startedAtMs).toBe(30_000)
    },
  )

  it.each([2 ** 52, 2 ** 53 - 1])(
    'deny boundary %j: out-of-domain clock leaves the workerCycle verbatim',
    (edge) => {
      const manager = registeredManager()
      const started = currentMs + 60_000

      manager.productionSystem.restoreStates(
        [siteState(started, started + 30_000)],
        edge,
      )

      const restored = manager.productionSystem.getState(SITE_ID)!.workerCycles![0]!
      expect(restored.startedAtMs).toBe(started)
      expect(restored.completesAtMs).toBe(started + 30_000)
    },
  )

  it('verbatim arm: past-due pair under a sane clock is NOT shifted (honest shape)', () => {
    const manager = registeredManager()
    const started = currentMs - 60_000

    manager.productionSystem.restoreStates(
      [siteState(started, started + 30_000)],
      currentMs,
    )

    const restored = manager.productionSystem.getState(SITE_ID)!.workerCycles![0]!
    expect(restored.startedAtMs).toBe(started)
    expect(restored.completesAtMs).toBe(started + 30_000)
  })
})

// ----------------------------------------------------------------------------
// (C) DecomposeSystem remaining clock edges
// ----------------------------------------------------------------------------

describe('r30 COR - C: decompose remaining clock edges', () => {
  function decomposeWithOre() {
    const bag = new MaterialBag()
    const ore = materials.find((m) => /_ore_/.test(m.id))!
    bag.add(ore, 10_000)
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(4)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs,
        started: true,
      },
      currentMs,
    )
    return { system, bag, oreId: ore.id }
  }

  it.each([2 ** 52, 2 ** 53, -(2 ** 53), -1, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'tick(%j) zero-advances and preserves nextCycleAt',
    (edge) => {
      const { system, bag, oreId } = decomposeWithOre()
      const oreBefore = bag.getAll().find((s) => s.material.id === oreId)!.amount

      system.tick(edge)

      expect(system.drainOutput()).toHaveLength(0)
      expect(bag.getAll().find((s) => s.material.id === oreId)!.amount).toBe(oreBefore)
      expect(system.getSaveState().nextCycleAt).toBe(currentMs)
    },
  )

  it.each([Number.NEGATIVE_INFINITY, -1, 2 ** 52, 2 ** 53, -(2 ** 53)])(
    'restore(state, %j) merges nextCycleAt verbatim - max(live, restored), no poison',
    (edge) => {
      const { system } = decomposeWithOre()

      system.restore(
        {
          settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
          nextCycleAt: currentMs + 45_000,
          started: true,
        },
        edge,
      )

      // verbatim merge: max(currentMs, currentMs + 45000) under bad clock
      expect(system.getSaveState().nextCycleAt).toBe(currentMs + 45_000)
    },
  )

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, -1, 2 ** 52, 2 ** 53])(
    'settleOffline(%j, since) returns 0 and preserves state',
    (edge) => {
      const { system } = decomposeWithOre()

      expect(system.settleOffline(edge, currentMs)).toBe(0)
      expect(system.drainOutput()).toHaveLength(0)
      expect(system.getSaveState().nextCycleAt).toBe(currentMs)
    },
  )

  it('admit edge: tick(2**52 - 1) still advances the due cycle', () => {
    const { system } = decomposeWithOre()

    system.tick(2 ** 52 - 1)

    expect(system.drainOutput().length).toBe(1)
    expect(Number.isFinite(system.getSaveState().nextCycleAt)).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (D) QuestManager.restore lastDailyResetAtMs truth table
// ----------------------------------------------------------------------------

describe('r30 COR - D: quest restore marker truth table', () => {
  const state = (marker: number) => ({
    active: [],
    completedOnceIds: [],
    lastDailyResetAtMs: marker,
    questFlags: [],
  })

  it.each(DENY_CLOCKS)(
    'restore(state, %j) keeps a finite marker VERBATIM (frozen = deny)',
    (edge) => {
      const manager = new QuestManager()

      manager.restore(state(currentMs), edge)

      expect(manager.getState().lastDailyResetAtMs).toBe(currentMs)
    },
  )

  it('sane clock clamps a future marker to nowMs (min(stamp, now))', () => {
    const manager = new QuestManager()

    manager.restore(state(currentMs + 86_400_000), currentMs)

    expect(manager.getState().lastDailyResetAtMs).toBe(currentMs)
  })

  it('sane clock keeps a past marker verbatim (min picks the stamp)', () => {
    const manager = new QuestManager()

    manager.restore(state(currentMs - 86_400_000), currentMs)

    expect(manager.getState().lastDailyResetAtMs).toBe(currentMs - 86_400_000)
  })

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, -1])(
    'non-finite/negative marker input normalizes to 0 (state side, any clock)',
    (badMarker) => {
      const manager = new QuestManager()

      manager.restore(state(badMarker), Number.NaN)
      expect(manager.getState().lastDailyResetAtMs).toBe(0)

      manager.restore(state(badMarker), currentMs)
      expect(manager.getState().lastDailyResetAtMs).toBe(0)
    },
  )
})

// ----------------------------------------------------------------------------
// (E) TribulationDirector.restoreRuntime truth table
// ----------------------------------------------------------------------------

describe('r30 COR - E: tribulation restoreRuntime truth table', () => {
  it.each(DENY_CLOCKS)(
    'restoreRuntime(slice, %j) keeps restored cooldownUntil VERBATIM (deny: parked, never mints early)',
    (edge) => {
      const director = new TribulationDirector({ eventBus: new EventBus() })

      director.restoreRuntime({ cooldownUntil: currentMs + 5000 }, edge)

      expect(director.serializeRuntime().cooldownUntil).toBe(currentMs + 5000)
      expect(director.getCooldownSeconds(currentMs)).toBeCloseTo(5, 0)
    },
  )

  it('sane clock clamps an over-authored cooldown at now + 300s', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })

    director.restoreRuntime({ cooldownUntil: currentMs + 600_000 }, currentMs)

    expect(director.serializeRuntime().cooldownUntil).toBe(currentMs + 300_000)
  })

  it('sane clock keeps a sub-bound cooldown verbatim', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })

    director.restoreRuntime({ cooldownUntil: currentMs + 5000 }, currentMs)

    expect(director.serializeRuntime().cooldownUntil).toBe(currentMs + 5000)
  })

  it.each(DENY_CLOCKS)(
    'restoreRuntime(undefined, %j) -> no cooldown (serialize omits a 0 stamp)',
    (edge) => {
      const director = new TribulationDirector({ eventBus: new EventBus() })

      director.restoreRuntime(undefined, edge)

      expect(director.serializeRuntime().cooldownUntil ?? 0).toBe(0)
      expect(director.getCooldownSeconds(currentMs)).toBe(0)
    },
  )
})

// ----------------------------------------------------------------------------
// (F) AlchemySystem.startJob invalid_clock origination gate
// ----------------------------------------------------------------------------

describe('r30 COR - F: startJob invalid_clock origination gate', () => {
  function alchemyContext() {
    const manager = registeredManager()
    const recipe = mortalRecipe()
    const variant = recipe.herbVariants[0]!
    const woodId = buildProfessionMaterialId('wood', recipe.fuelWoodRealmId, variant.age)
    const bag = manager.materialBag
    bag.add(manager.materialRegistry.get(variant.materialId), recipe.herbAmount)
    bag.add(manager.materialRegistry.get(woodId), recipe.fuelWoodAmount)
    return { manager, recipe, variant, bag }
  }

  it.each(DENY_CLOCKS)(
    'startJob(..., %j, ...) -> {ok:false, reason:invalid_clock} with ZERO burn and no job',
    (edge) => {
      const { manager, recipe, variant, bag } = alchemyContext()
      const herbBefore = bag.getAmount(variant.materialId)

      const result = manager.alchemySystem.startJob(
        recipe,
        variant.materialId,
        bag,
        manager.materialRegistry,
        1_000_000,
        1,
        edge,
        4,
      )

      expect(result).toEqual({ ok: false, reason: 'invalid_clock' })
      expect(bag.getAmount(variant.materialId)).toBe(herbBefore)
      expect(manager.alchemySystem.getJobs()).toHaveLength(0)
    },
  )

  it('precedence: invalid_clock fires BEFORE scope_hidden - a dormant recipe under a bad clock still returns invalid_clock', () => {
    const { manager } = alchemyContext()
    // A recipe outside the beta family: cook one up that is not in the
    // catalog but whose id fails the family gate.
    const dormantRecipe = { ...mortalRecipe(), id: 'alchemy_dormant_probe_xyz' }

    const result = manager.alchemySystem.startJob(
      dormantRecipe,
      mortalRecipe().herbVariants[0]!.materialId,
      manager.materialBag,
      manager.materialRegistry,
      1_000_000,
      1,
      Number.NaN,
      4,
    )

    expect(result).toEqual({ ok: false, reason: 'invalid_clock' })
    // control: same dormant recipe under a sane clock is refused by the
    // family gate, proving the precedence order
    const control = manager.alchemySystem.startJob(
      dormantRecipe,
      mortalRecipe().herbVariants[0]!.materialId,
      manager.materialBag,
      manager.materialRegistry,
      1_000_000,
      1,
      currentMs,
      4,
    )
    expect(control.ok).toBe(false)
    expect(control.reason).not.toBe('invalid_clock')
  })

  it('deny edge: startJob(..., negative/out-of-domain, ...) refuses invalid_clock before any burn', () => {
    const { manager, recipe, variant, bag } = alchemyContext()

    for (const edge of [-1, -(2 ** 53 - 1), 2 ** 52]) {
      const result = manager.alchemySystem.startJob(
        recipe,
        variant.materialId,
        bag,
        manager.materialRegistry,
        1_000_000,
        1,
        edge,
        4,
      )

      // r30-AUT-3: a clock outside [0, 2^52) can no longer mint a job
      // stamped outside the persisted domain (or an already-due one).
      expect(result).toEqual({ ok: false, reason: 'invalid_clock' })
    }
    expect(manager.alchemySystem.getJobs()).toHaveLength(0)
  })

  it('honest clock regression: startJob burns exactly once and mints the job', () => {
    const { manager, recipe, variant, bag } = alchemyContext()
    const herbBefore = bag.getAmount(variant.materialId)

    const result = manager.alchemySystem.startJob(
      recipe,
      variant.materialId,
      bag,
      manager.materialRegistry,
      1_000_000,
      1,
      currentMs,
      4,
    )

    expect(result.ok).toBe(true)
    expect(bag.getAmount(variant.materialId)).toBe(herbBefore - recipe.herbAmount)
    expect(manager.alchemySystem.getJobs()).toHaveLength(1)
    expect(verifyAlchemyJobReservation(manager.alchemySystem.getJobs()[0]!, recipe)).toBeNull()
  })
})

// ----------------------------------------------------------------------------
// (G) useAppLifecycle tick/persist gates - entryStage x canMutate truth table
// ----------------------------------------------------------------------------

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
      load: vi.fn(async () => ({ status: 'empty' as const, revision: 0 as const })),
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      reset: vi.fn(),
      capability: 'local-only' as const,
    } as never,
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
      materialRegistry: { has: () => false },
      materialBag: { add: vi.fn(), getAll: () => [] },
      techniqueManager: { getAll: () => [] },
      skillManager: { getAll: () => [] },
      equipmentBag: { getAll: () => [] },
      pillBag: { getAll: () => [] },
      equipmentSlotManager: { getAll: () => [] },
      alchemySystem: { getJobs: () => [] },
      questManager: { getState: () => ({}) },
      decomposeSystem: { getSaveState: () => ({}) },
      tribulationDirector: { serializeRuntime: () => ({}) },
      productionSystem: { getSiteDefinitions: () => [], getAllStates: () => [] },
      setProductionAutoRestart: vi.fn(),
      setActivePlayer: vi.fn(),
      buildingManager: { add: vi.fn(), getAll: () => [] },
      refreshAutoWorkerCapacity: vi.fn(),
      restoreFromSave: vi.fn(),
      freezeCombat: vi.fn(),
      resumeCombat: vi.fn(),
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

describe('r30 COR - G: lifecycle tick/persist gates per entryStage', () => {
  it.each(['intro', 'auth', 'character', 'game', 'error'])(
    'tick callback fires only under entryStage=game (stage=%s)',
    (stage) => {
      const stubs = lifecycleStubs()
      const lifecycle = useAppLifecycle({ ...stubs } as never)
      const tick = vi.fn()

      lifecycle.startTickLoop(tick)
      stubs.entryStage.value = stage
      stubs.intervals[0]!()

      expect(tick).toHaveBeenCalledTimes(stage === 'game' ? 1 : 0)
      lifecycle.stopAll()
    },
  )

  it('canMutate=false at game stage still blocks the tick (authority gate preserved)', () => {
    const stubs = lifecycleStubs()
    stubs.authority.canMutate.mockReturnValue(false)
    const lifecycle = useAppLifecycle({ ...stubs } as never)
    const tick = vi.fn()

    lifecycle.startTickLoop(tick)
    stubs.entryStage.value = 'game'
    stubs.intervals[0]!()

    expect(tick).not.toHaveBeenCalled()
    lifecycle.stopAll()
  })

  it.each(['intro', 'auth', 'character', 'error'])(
    'autosave persistProgress is skipped under entryStage=%s (persist gate parity)',
    async (stage) => {
      const stubs = lifecycleStubs()
      const lifecycle = useAppLifecycle({ ...stubs } as never)

      lifecycle.startAutosave()
      stubs.entryStage.value = stage
      stubs.intervals[0]!()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(stubs.persistPlayer).not.toHaveBeenCalled()
      lifecycle.stopAll()
    },
  )

  it('autosave fires under entryStage=game (control)', async () => {
    const stubs = lifecycleStubs()
    const lifecycle = useAppLifecycle({ ...stubs } as never)

    lifecycle.startAutosave()
    stubs.intervals[0]!()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(stubs.persistPlayer).toHaveBeenCalledTimes(1)
    lifecycle.stopAll()
  })
})

// ----------------------------------------------------------------------------
// (H) OnlineSessionController substrate: local-mode refuse leaves canMutate on
// ----------------------------------------------------------------------------

describe('r30 COR - H: authority substrate behind the entryStage claim', () => {
  function controller(withReconnect: boolean) {
    return new OnlineSessionController({
      monotonicNow: () => 0,
      scheduleInterval: () => 1,
      clearHandle: () => undefined,
      reconnect: withReconnect ? async () => ({ status: 'unavailable' as const }) : undefined,
    })
  }

  const REFUSE = {
    status: 'unavailable' as const,
    code: 'SAVE_INVALID' as const,
    message: 'refused',
    retryable: false,
  }

  it('local mode (no reconnect dep): a coded refuse leaves authority ready - the entryStage gate is what freezes the sim', () => {
    const ctl = controller(false)
    ctl.beginChecking()
    ctl.markReady()
    expect(ctl.canMutate()).toBe(true)

    ctl.observeSaveResult(REFUSE)

    expect(ctl.authorityState).toBe('ready')
    expect(ctl.canMutate()).toBe(true)
  })

  it('remote mode (reconnect dep): the same refuse lands recovery terminal -> canMutate false', () => {
    const ctl = controller(true)
    ctl.beginChecking()
    ctl.markReady()

    ctl.observeSaveResult(REFUSE)

    expect(ctl.authorityState).toBe('recovery')
    expect(ctl.canMutate()).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// (I) useBootFlow stage truth table + fail() retry bound
// ----------------------------------------------------------------------------

function routeAdapterStub(active: string) {
  return {
    activeRoute: ref(active),
    phase: ref('idle'),
    targetRoute: ref<string | null>(null),
    error: ref<{ failedRequest: { target: string } } | null>(null),
  }
}

function coordinatorStub(results: Array<'ok' | 'rejected' | 'failed'>) {
  const request = vi.fn(async () => ({ status: results.shift() ?? 'ok' }))
  return { request, whenIdle: vi.fn(async () => undefined), setBootSubphase: vi.fn() }
}

describe('r30 COR - I: bootFlow stage derivation + fail() bound', () => {
  it.each([
    ['intro', 'intro'],
    ['auth', 'auth'],
    ['character', 'character'],
    ['error', 'error'],
    ['home', 'game'],
    ['combat', 'game'],
    ['tribulation', 'game'],
  ])('activeRoute=%s -> stage=%s', (route, expected) => {
    const flow = useBootFlow(coordinatorStub([]) as never, routeAdapterStub(route) as never)
    expect(flow.stage.value).toBe(expected)
  })

  it('pending game target promotes to game only once the curtain is closed (phase >= loading)', () => {
    const adapter = routeAdapterStub('auth')
    adapter.targetRoute.value = 'home'

    adapter.phase.value = 'closing'
    const flow = useBootFlow(coordinatorStub([]) as never, adapter as never)
    expect(flow.stage.value).toBe('auth')

    adapter.phase.value = 'loading'
    expect(flow.stage.value).toBe('game')
  })

  it('demotion waits for the route to actually change (game->error transition keeps game)', () => {
    const adapter = routeAdapterStub('home')
    adapter.targetRoute.value = 'error'
    adapter.phase.value = 'closing'

    const flow = useBootFlow(coordinatorStub([]) as never, adapter as never)
    expect(flow.stage.value).toBe('game')

    adapter.phase.value = 'loading'
    // still game: targetRoute 'error' is not a game route, activeRoute
    // 'home' is - demotion only lands when the route flips
    expect(flow.stage.value).toBe('game')
  })

  it('fail() retries the error mount at most 10 times then gives up', async () => {
    const coordinator = coordinatorStub(Array(20).fill('rejected'))
    const flow = useBootFlow(coordinator as never, routeAdapterStub('home') as never)

    flow.fail()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(coordinator.request).toHaveBeenCalledTimes(10)
  })

  it('fail() stops retrying on the first successful mount', async () => {
    const coordinator = coordinatorStub(['rejected', 'ok'])
    const flow = useBootFlow(coordinator as never, routeAdapterStub('home') as never)

    flow.fail()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(coordinator.request).toHaveBeenCalledTimes(2)
  })
})

// ----------------------------------------------------------------------------
// (J) saveShapeValidation cap boundaries
// ----------------------------------------------------------------------------

describe('r30 COR - J: collection cap boundaries', () => {
  it('requireArray: player.selectedTalentIds at exactly 1024 emits no cap issue', () => {
    const save = validWireSave()
    save.player.selectedTalentIds = Array.from({ length: 1024 }, (_, i) => `tal_probe_${i}`)

    const shape = validateGameSaveShape(save)

    expect(
      shape.issues.filter(
        (i) => i.path === 'player.selectedTalentIds' && i.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toHaveLength(0)
  })

  it('requireArray: 1025 selectedTalentIds -> cap issue, zero per-index issues (walk skipped)', () => {
    const save = validWireSave()
    save.player.selectedTalentIds = Array.from({ length: 1025 }, (_, i) => `tal_probe_${i}`)

    const shape = validateGameSaveShape(save)

    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some(
        (i) => i.path === 'player.selectedTalentIds' && i.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(true)
    expect(
      shape.issues.filter((i) => i.path.startsWith('player.selectedTalentIds[')),
    ).toHaveLength(0)
  })

  it('optionalArray: alchemyJobs at 1025 -> cap issue, zero per-index issues', () => {
    const save = validWireSave()
    ;(save as unknown as Record<string, unknown>).alchemyJobs = Array.from(
      { length: 1025 },
      () => ({}),
    )

    const shape = validateGameSaveShape(save)

    expect(shape.ok).toBe(false)
    // root-level field: path is '<root>.alchemyJobs' -> '.alchemyJobs'
    expect(
      shape.issues.some(
        (i) => i.path.endsWith('alchemyJobs') && i.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(true)
    expect(shape.issues.filter((i) => i.path.includes('alchemyJobs['))).toHaveLength(0)
  })

  it('nodeLevels: cap-gate parity - root refuses at 1025, walks pay zero reads', () => {
    const save = validWireSave()
    const rec: Record<string, number> = {}
    for (let i = 0; i < 1025; i += 1) {
      rec[`nl_probe_${i}`] = 0
    }
    const gets: string[] = []
    const proxy = new Proxy(rec, {
      get(target, prop) {
        if (typeof prop === 'string' && prop.startsWith('nl_probe_')) {
          gets.push(prop)
        }
        return Reflect.get(target, prop)
      },
    })
    ;(save.player as unknown as Record<string, unknown>).nodeLevels = proxy

    const shape = validateGameSaveShape(save)

    expect(
      shape.issues.some(
        (i) => i.path === 'player.nodeLevels' && i.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(true)
    // cap-gated walks (validateSkillCoreCoverage binding + siblings) read
    // no element keys - the refuse verdict comes from the root check
    expect(gets).toHaveLength(0)
  })

  it('equipment protection cap: 10 protected entries admit, 11 refuse (union pool)', () => {
    const save = validWireSave()
    const entry = (id: string, flag: 'locked' | 'favorite') => ({
      instanceId: id,
      itemId: 'item_probe',
      [flag]: true,
    })

    // exactly 10 locked -> no protection-cap issue
    save.equipment = Array.from({ length: 10 }, (_, i) => entry(`e${i}`, 'locked')) as never
    let shape = validateGameSaveShape(save)
    expect(
      shape.issues.filter(
        (i) => i.path === 'equipment' && i.message.includes('protected'),
      ),
    ).toHaveLength(0)

    // 11th locked -> refuse
    save.equipment = Array.from({ length: 11 }, (_, i) => entry(`e${i}`, 'locked')) as never
    shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some(
        (i) => i.path === 'equipment' && i.message.includes('protected'),
      ),
    ).toBe(true)

    // union pool: 6 locked + 5 favorite = 11 -> refuse
    save.equipment = [
      ...Array.from({ length: 6 }, (_, i) => entry(`l${i}`, 'locked')),
      ...Array.from({ length: 5 }, (_, i) => entry(`f${i}`, 'favorite')),
    ] as never
    shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some(
        (i) => i.path === 'equipment' && i.message.includes('protected'),
      ),
    ).toBe(true)
  })

  it('bag-to-validator parity: a produced bag with EQUIPMENT_PROTECTION_CAP protected entries validates clean', () => {
    const writer = registeredManager()
    const player = createDefaultPlayer()
    writer.setActivePlayer(player)
    primeMortalCreationPick(player, writer.skillManager)

    for (let i = 0; i < EQUIPMENT_PROTECTION_CAP; i += 1) {
      writer.equipmentBag.add(
        makeEquipmentInstance({
          instanceId: `eq_par_${i}`,
          itemId: 'item_probe',
          locked: i % 2 === 0,
          favorite: i % 2 === 1,
        }),
      )
    }

    const save = JSON.parse(JSON.stringify(buildGameSave(player, writer))) as GameSave
    expect(save.equipment.filter((e) => e.locked || e.favorite)).toHaveLength(
      EQUIPMENT_PROTECTION_CAP,
    )

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (K) sibling-gap probes (findings)
// ----------------------------------------------------------------------------

describe('r30 COR - K: sibling cap-bypass walks (finding evidence)', () => {
  it('K1 [fixed]: over-cap player.selectedTalentIds pays zero element reads in validateSkillCoreCoverage (cap-gated binding)', () => {
    const save = validWireSave()
    const arr = Array.from({ length: 1025 }, (_, i) => `st_probe_${i}`)
    const elementReads: string[] = []
    const proxy = new Proxy(arr, {
      get(target, prop) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          elementReads.push(prop)
        }
        return Reflect.get(target, prop)
      },
      has(target, prop) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          elementReads.push(prop)
        }
        return Reflect.has(target, prop)
      },
    })
    ;(save.player as unknown as Record<string, unknown>).selectedTalentIds = proxy

    const shape = validateGameSaveShape(save)

    // verdict refuses via the cap (unchanged)...
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some(
        (i) => i.path === 'player.selectedTalentIds' && i.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(true)
    // ...and the coverage walk skips the refused array entirely -
    // the binding now gates on ID_COLLECTION_CAP like the root walk
    expect(elementReads.length).toBe(0)
  })

  it('K2 [fixed]: over-cap player.persistentTimedEffects pays zero .filter element reads at the liveTltPercent walk', () => {
    const save = validWireSave()
    const arr = Array.from({ length: 1025 }, () => ({ expiresAtMs: 1 }))
    const elementReads: string[] = []
    const proxy = new Proxy(arr, {
      get(target, prop) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          elementReads.push(prop)
        }
        return Reflect.get(target, prop)
      },
      has(target, prop) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          elementReads.push(prop)
        }
        return Reflect.has(target, prop)
      },
    })
    ;(save.player as unknown as Record<string, unknown>).persistentTimedEffects = proxy

    const shape = validateGameSaveShape(save)

    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some(
        (i) =>
          i.path === 'player.persistentTimedEffects' &&
          i.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(true)
    expect(elementReads.length).toBe(0)
  })

  it('K3 [fixed]: applyTimedEffect non-stackable merge + verbatim push clamp expiresAtMs into the admitted domain - a crafted stamp no longer self-bricks the next save write', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    // arm 1: verbatim push of a caller-supplied out-of-domain expiresAtMs
    manager.effectOps.applyTimedEffect(player, {
      id: 'probe_effect',
      sourceItemId: 'probe_src',
      effectGroup: 'probe_group',
      durationStackable: false,
      appliedAtMs: currentMs,
      expiresAtMs: 1e16, // > 2^52 - outside the admitted timestamp domain
      modifiers: [],
    })

    // arm 2: non-stackable merge takes max() of a caller stamp verbatim
    manager.effectOps.applyTimedEffect(player, {
      id: 'probe_effect_2',
      sourceItemId: 'probe_src',
      effectGroup: 'probe_group',
      durationStackable: false,
      appliedAtMs: currentMs,
      expiresAtMs: 9e15,
      modifiers: [],
    })

    const persisted = player.persistentTimedEffects.find(
      (e) => e.effectGroup === 'probe_group',
    )!
    // the verbatim push clamps 1e16 into the admitted domain, and the
    // non-stackable merge clamps max(existing, incoming) the same way
    expect(persisted.expiresAtMs).toBe(2 ** 52 - 1)

    const save = JSON.parse(JSON.stringify(buildGameSave(player, manager))) as GameSave
    const shape = validateGameSaveShape(save)

    // no expiresAtMs-domain refusal remains - the persisted stamp sits
    // inside |x| < 2^52. (This payload still refuses on the unrelated
    // crafted 'probe_src' sourceItemId witness - that IS the deny verdict
    // working; a real writer source would admit.)
    expect(
      shape.issues.some(
        (i) => i.path.includes('persistentTimedEffects') && i.path.includes('expiresAtMs'),
      ),
    ).toBe(false)

    // contrast: the stackable arm clamps the same crafted input
    const player2 = createDefaultPlayer()
    manager.effectOps.applyTimedEffect(player2, {
      id: 'probe_stack',
      sourceItemId: 'probe_src',
      effectGroup: 'stack_group',
      durationStackable: true,
      appliedAtMs: currentMs,
      expiresAtMs: currentMs + 1000,
      modifiers: [],
    })
    manager.effectOps.applyTimedEffect(player2, {
      id: 'probe_stack',
      sourceItemId: 'probe_src',
      effectGroup: 'stack_group',
      durationStackable: true,
      appliedAtMs: 1e16,
      expiresAtMs: 1e16,
      modifiers: [],
    })
    const clamped = player2.persistentTimedEffects.find(
      (e) => e.effectGroup === 'stack_group',
    )!
    expect(clamped.expiresAtMs).toBeLessThanOrEqual(2 ** 52 - 1)
  })
})

// ----------------------------------------------------------------------------
// (L) honest-shape regression pins
// ----------------------------------------------------------------------------

describe('r30 COR - L: honest-shape regressions', () => {
  it('writer-produced save validates clean (no false positives from cap walks)', () => {
    const shape = validateGameSaveShape(validWireSave())
    expect(shape.ok).toBe(true)
    expect(shape.issues).toHaveLength(0)
  })

  it('honest restoreJobs: in-flight job keeps stamps and digest', () => {
    const { job } = mortalJob(currentMs - 60_000, 'r30_reg')
    const writerDigest = job.reservation!.digest
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([job], currentMs)
    const restored = reader.alchemySystem.getJobs()[0]!

    expect(restored.startedAtMs).toBe(currentMs - 60_000)
    expect(restored.reservation!.digest).toBe(writerDigest)
    expect(verifyAlchemyJobReservation(restored, mortalRecipe())).toBeNull()
  })

  it('honest ProductionSystem.restoreStates: past-due cycle restores verbatim', () => {
    const manager = registeredManager()
    const siteId = THANH_VAN_PRODUCTION_SITES[0]!.siteId

    manager.productionSystem.restoreStates(
      [
        {
          siteId,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [
            {
              cycleId: 'cyc_honest',
              siteId,
              collectionRealmId: 'mortal',
              siteLevelAtStart: 1,
              rewardTableVersion: 1,
              rollSeed: 7,
              startedAtMs: currentMs - 120_000,
              completesAtMs: currentMs - 60_000,
            },
          ],
        },
      ],
      currentMs,
    )

    const cycle = manager.productionSystem.getState(siteId)!.workerCycles![0]!
    expect(cycle.startedAtMs).toBe(currentMs - 120_000)
    expect(cycle.completesAtMs).toBe(currentMs - 60_000)
  })

  it('setProtected round-trip: 10 protected items produce a save the validator admits', () => {
    const bag = new EquipmentBag()
    for (let i = 0; i < EQUIPMENT_PROTECTION_CAP + 2; i += 1) {
      bag.add(
        makeEquipmentInstance({
          instanceId: `rt_${i}`,
          itemId: 'item_probe',
        }),
      )
    }
    for (let i = 0; i < EQUIPMENT_PROTECTION_CAP; i += 1) {
      expect(bag.setProtected(`rt_${i}`, i % 2 === 0 ? 'locked' : 'favorite', true).ok).toBe(true)
    }
    // the 11th distinct instance is refused - union pool exhausted
    expect(bag.setProtected(`rt_${EQUIPMENT_PROTECTION_CAP}`, 'locked', true)).toEqual({
      ok: false,
      reason: 'protection_cap',
    })
  })
})
