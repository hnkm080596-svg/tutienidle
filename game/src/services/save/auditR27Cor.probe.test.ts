// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameSave, RestoreTimeAuthority } from './saveTypes'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { CloudSaveCoordinator } from '../cloudSave/CloudSaveCoordinator'
import type { CloudSaveService } from '../cloudSave/CloudSaveService'
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
import { PillBag } from '../../core/pill/PillBag'
import { EventBus } from '../../core/events/EventBus'
import {
  TribulationDirector,
  TRIBULATION_COOLDOWN_SECONDS,
} from '../../core/tribulation/TribulationDirector'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { ProductionSystem } from '../../core/production/ProductionSystem'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_GROTTO_HERBS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_PRODUCTION_SITES,
} from '../../core/production/ProductionCatalog'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import { MaterialBag } from '../../core/material/MaterialBag'
import type { ProductionCycle } from '../../core/production/ProductionTypes'

// ============================================================================
// QA probe - fixpoint r27 COR wave. Audits the r26 adjudication batch at
// a9a9c37c (deadline re-anchor at restore + armed refuse envelope + uniform
// collection caps):
//
//   (W) began-pair shift contract: post-dated startedAtMs re-grounds at the
//       restore clock, span preserved exactly, strict `>` boundary, reserved
//       alchemy jobs get a re-derived digest that still replays; witnessless
//       jobs keep no reservation (no fabricated grant).
//   (F) restoreClock floor: restoreClockMs = min(authorityNowMs, Date.now())
//       has no lower bound. sanitizeRestoreAuthority degrades non-finite or
//       |x| >= 2^52 stamps to the zero-accrual deny primitive, but a finite
//       LOW stamp (epoch-seconds unit confusion, stale/corrupt server window)
//       passes cleanly - and every honest began-pair post-dates it, so the
//       re-anchor shifts deadlines into 1970 where the next live tick pays
//       them instantly, bypassing the offline-settle machinery entirely.
//   (G) verify order: alchemyJobReservationDigest reads
//       reservation.specialIngredients.map BEFORE verify checks the field is
//       an array - a reservation missing it throws TypeError through
//       validateGameSaveShape; in driveSave the .catch(adapterThrow) converts
//       it to a codeless 'SAVE_ADAPTER_THROW' unavailable - authorityState-
//       ForError(undefined) -> 'reconnecting' churn, escaping the r26 armed
//       SAVE_INVALID -> 'recovery' envelope the whole class is built on.
//   (C) cap sibling sweep: every channel r26 capped refuses >1024 entries;
//       player.talentLevels (same Record<string,number> shape) still walks
//       unbounded at admission.
// ============================================================================

const FOREST_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.forest
const MORTAL_CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['mortal'] ?? 100, 1) * 1000

let currentMs = 1_725_160_000_000

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

function mockService(capability: 'local' | 'remote-authoritative'): {
  service: CloudSaveService
  saveCalls: GameSave[]
} {
  const saveCalls: GameSave[] = []
  const service = {
    capability,
    load: async () => ({ status: 'empty' as const, revision: 0 }),
    save: async (save: GameSave, _expectedRevision: number) => {
      saveCalls.push(save)
      return { status: 'ok' as const, revision: saveCalls.length }
    },
  } as unknown as CloudSaveService
  return { service, saveCalls }
}

function createProductionSystem(): ProductionSystem {
  return new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
  })
}

function workerCycle(startedAtMs: number, cycleId: string): ProductionCycle {
  return {
    cycleId,
    siteId: FOREST_SITE_ID,
    collectionRealmId: 'mortal',
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 42,
    startedAtMs,
    completesAtMs: startedAtMs + MORTAL_CYCLE_MS,
  }
}

function mortalRecipe() {
  return alchemyRecipes.find((r) => r.id === 'alchemy_tu_linh_dan_mortal')!
}

function mortalJob(startedAtMs: number, jobId: string, withReservation = true) {
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
  return { job, recipe, span, fixture: withReservation ? job : { ...job, reservation: undefined } }
}

describe('auditR27 COR probe - began-pair shift contract (W)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('W1 production: post-dated pair re-grounds at restoreNow with span exact; boundary `>` strict', () => {
    const system = createProductionSystem()

    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 4,
          workerCycles: [
            workerCycle(currentMs + 60_000, 'post'), // post-dated: shifts to [now, now+span]
            workerCycle(currentMs - 5_000, 'flight'), // honest in-flight: untouched
            workerCycle(currentMs, 'edge'), // boundary: started==restoreNow untouched
            workerCycle(currentMs + 1, 'edge1'), // +1ms: shifts by 1
          ],
        },
      ],
      currentMs,
    )

    const cycles = system.getState(FOREST_SITE_ID)!.workerCycles!
    const byId = new Map(cycles.map((c) => [c.cycleId, c]))

    const post = byId.get('post')!
    expect(post.startedAtMs).toBe(currentMs)
    expect(post.completesAtMs).toBe(currentMs + MORTAL_CYCLE_MS)
    expect(post.rollSeed).toBe(42)

    const flight = byId.get('flight')!
    expect(flight.startedAtMs).toBe(currentMs - 5_000)
    expect(flight.completesAtMs).toBe(currentMs - 5_000 + MORTAL_CYCLE_MS)

    const edge = byId.get('edge')!
    expect(edge.startedAtMs).toBe(currentMs)
    expect(edge.completesAtMs).toBe(currentMs + MORTAL_CYCLE_MS)

    const edge1 = byId.get('edge1')!
    expect(edge1.startedAtMs).toBe(currentMs)
    expect(edge1.completesAtMs).toBe(currentMs + MORTAL_CYCLE_MS)
  })

  it('W2 alchemy: shifted pair re-derives the reservation digest - witness still replays, settle delivers', () => {
    const { job, recipe, span } = mortalJob(currentMs + 60_000, 'r27_w2')
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([job], currentMs)
    const shifted = reader.alchemySystem.getJobs()[0]!

    expect(shifted.startedAtMs).toBe(currentMs)
    expect(shifted.completesAtMs).toBe(currentMs + span)
    expect(shifted.reservation).toBeDefined()
    expect(
      verifyAlchemyJobReservation(shifted, recipe),
    ).toBeNull()
    expect(
      alchemyJobReservationDigest(shifted, shifted.reservation!),
    ).toBe(shifted.reservation!.digest)

    // The shifted job settles at its own (new) deadline - witness replays.
    const bag = new PillBag()
    reader.alchemySystem.tick(currentMs + span, bag, (id) => ({ id }), () => 0)
    const events = reader.alchemySystem.drainSettlementEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.success).toBe(true)
    expect(bag.getAmount(recipe.pillId)).toBeGreaterThanOrEqual(1)
  })

  it('W3 alchemy: specialIngredients-bearing reservation replays through the shift', () => {
    const recipe = alchemyRecipes.find((r) => r.id === 'alchemy_thong_mach_dan')!
    expect(recipe.specialIngredients?.length).toBeGreaterThan(0)
    const variant = recipe.herbVariants[0]!
    const span = alchemySecondsFor(recipe, 1) * 1000

    const reader = registeredManager()
    reader.alchemySystem.restoreJobs(
      [
        alchemyJobFixture(
          {
            jobId: 'r27_w3',
            recipeId: recipe.id,
            pillId: recipe.pillId,
            herbMaterialId: variant.materialId,
            startedAtMs: currentMs + 10_000,
            completesAtMs: currentMs + 10_000 + span,
            roomLevelAtStart: 1,
          },
          undefined,
          recipe,
        ),
      ],
      currentMs,
    )
    const shifted = reader.alchemySystem.getJobs()[0]!
    expect(shifted.startedAtMs).toBe(currentMs)
    expect(verifyAlchemyJobReservation(shifted, recipe)).toBeNull()
  })

  it('W4 alchemy: a witnessless job is shifted; the (pre-existing) restore fabricate gives it an empty reservation - settle still fails it', () => {
    const { fixture } = mortalJob(currentMs + 60_000, 'r27_w4', false)
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([fixture], currentMs)
    const shifted = reader.alchemySystem.getJobs()[0]!
    expect(shifted.startedAtMs).toBe(currentMs)
    // Pre-existing shape (NOT an r26 change): the unconditional
    // reservation-clone spreads undefined into { specialIngredients: [] }.
    // Deny-direction preserved: settle still fails the job.
    expect(shifted.reservation).toEqual({ specialIngredients: [] })

    const bag = new PillBag()
    reader.alchemySystem.tick(currentMs + 3_600_000, bag, (id) => ({ id }), () => 0)
    const events = reader.alchemySystem.drainSettlementEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.success).toBe(false)
    expect(events[0]!.delivered).toBe(0)
  })

  it('W5 tribulation: honest cooldownUntil kept verbatim; beyond-authored-max clamps at restoreNow + span', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })

    // Honest stamp inside the bound: kept.
    director.restoreRuntime({ cooldownUntil: currentMs + 60_000 }, currentMs)
    expect(director.serializeRuntime().cooldownUntil).toBe(currentMs + 60_000)

    // Skewed stamp beyond restoreNow + authored span: re-anchored.
    const skewed = new TribulationDirector({ eventBus: new EventBus() })
    skewed.restoreRuntime(
      { cooldownUntil: currentMs + 3_600_000 + TRIBULATION_COOLDOWN_SECONDS * 1000 },
      currentMs,
    )
    expect(skewed.serializeRuntime().cooldownUntil).toBe(
      currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000,
    )
  })

  it('W6 decompose: honest nextCycleAt kept; beyond-cap clamps at restoreNow + cycleMs; merge keeps the later', () => {
    const cycleSeconds = 30
    const system = new DecomposeSystem(new MaterialBag(), { cycleSeconds })

    // Fresh instance: deadline inside the cap kept verbatim.
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs + 10_000,
        started: true,
      },
      currentMs,
    )
    expect(system.getSaveState().nextCycleAt).toBe(currentMs + 10_000)

    // Same instance, second restore over an already-advanced timer: merge
    // keeps the LARGER deadline (repeat-settle protection) - still bounded
    // by the cap.
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: 0,
        started: true,
      },
      currentMs,
    )
    expect(system.getSaveState().nextCycleAt).toBe(currentMs + 10_000)

    // Skewed stamp beyond restoreNow + cycleMs: re-anchored at the cap.
    const skewed = new DecomposeSystem(new MaterialBag(), { cycleSeconds })
    skewed.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs + 9_000_000,
        started: true,
      },
      currentMs,
    )
    expect(skewed.getSaveState().nextCycleAt).toBe(currentMs + cycleSeconds * 1000)
  })

  it('W7 regression: absent authority keeps legacy client clock - honest saves restore verbatim', () => {
    const { job, span } = mortalJob(currentMs - 60_000, 'r27_w7')
    const writer = registeredManager()
    const writerPlayer = createDefaultPlayer()
    writer.setActivePlayer(writerPlayer)
    primeMortalCreationPick(writerPlayer, writer.skillManager)
    const wire = JSON.parse(JSON.stringify(buildGameSave(writerPlayer, writer))) as GameSave
    wire.alchemyJobs = [job as never]
    wire.player.lastSavedAt = currentMs

    const reader = registeredManager()
    const readerPlayer = createDefaultPlayer()
    reader.setActivePlayer(readerPlayer)
    reader.saveOps.restoreFromSave(wire, undefined)
    const restored = reader.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(currentMs - 60_000)
    expect(restored.completesAtMs).toBe(currentMs - 60_000 + span)
  })
})

describe('auditR27 COR probe - restoreClock floor / corrupt-low authority (F)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('F1 production: finite-low authority lands every honest cycle head in 1970 - next tick pays it instantly', () => {
    const system = createProductionSystem()

    // restoreNowMs = -1 simulates what GameManagerSaveRestore computes
    // when cold-boot untilMs is any low finite stamp (sanitize passes it).
    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(currentMs - 60_000, 'honest')],
        },
      ],
      -1,
    )

    const shifted = system.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(shifted.startedAtMs).toBe(-1)
    expect(shifted.completesAtMs).toBe(-1 + MORTAL_CYCLE_MS)
    expect(shifted.completesAtMs).toBeLessThan(currentMs)

    // The next live tick (advanceWorkerLanes observe mode) treats the
    // shifted deadline as already due - the cycle settles NOW instead of
    // waiting its authored completesAt. Grant flows through tick, not
    // settleOffline, so the offline cap never sees it.
    const result = advanceWorkerLanes({
      siteId: FOREST_SITE_ID,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: CYCLE_BASE_SECONDS_BY_REALM['mortal'] ?? 100,
      cycleMs: MORTAL_CYCLE_MS,
      pending: [shifted],
      slots: 1,
      nowMs: currentMs,
      advanceMode: 'observe',
      rng: () => 0.5,
    })
    expect(result.completed).toHaveLength(1)
    expect(result.completed[0]!.cycleId).toBe('honest')
  })

  it('F2 alchemy: finite-low authority pays a reserved job instantly through tick (digest replays)', () => {
    const { job, recipe } = mortalJob(currentMs - 60_000, 'r27_f2')
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([job], -1)
    const shifted = reader.alchemySystem.getJobs()[0]!
    expect(shifted.startedAtMs).toBe(-1)
    expect(shifted.completesAtMs).toBeLessThan(currentMs)
    expect(verifyAlchemyJobReservation(shifted, recipe)).toBeNull()

    const bag = new PillBag()
    reader.alchemySystem.tick(currentMs, bag, (id) => ({ id }), () => 0)
    const events = reader.alchemySystem.drainSettlementEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.success).toBe(true)
    expect(events[0]!.delivered).toBeGreaterThanOrEqual(1)
  })

  it('F3 tribulation: finite-low authority evaporates the authored cooldown', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })
    // Honest stamped cooldown (now + 300s) under restoreNow=-1 clamps to
    // -1 + 300s = year-1970 - already expired.
    director.restoreRuntime(
      { cooldownUntil: currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000 },
      -1,
    )
    const restored = director.serializeRuntime()
    expect(restored.cooldownUntil).toBe(-1 + TRIBULATION_COOLDOWN_SECONDS * 1000)
    expect(restored.cooldownUntil).toBeLessThan(currentMs)
  })

  it('F4 decompose: finite-low authority pulls nextCycleAt into 1970 - the cycle fires on the next tick', () => {
    const system = new DecomposeSystem(new MaterialBag(), { cycleSeconds: 30 })
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs + 25_000,
        started: true,
      },
      -1,
    )
    const next = system.getSaveState().nextCycleAt
    expect(next).toBe(-1 + 30_000)
    expect(next).toBeLessThan(currentMs)
  })

  it('F5 integration: real saveOps.restoreFromSave under corrupt-low cold-boot collapses all four channels', () => {
    const writer = registeredManager()
    const writerPlayer = createDefaultPlayer()
    writer.setActivePlayer(writerPlayer)
    primeMortalCreationPick(writerPlayer, writer.skillManager)
    const wire = JSON.parse(JSON.stringify(buildGameSave(writerPlayer, writer))) as GameSave

    const { job, span } = mortalJob(currentMs - 60_000, 'r27_f5')
    wire.alchemyJobs = [job as never]
    wire.productionSites = [
      {
        siteId: FOREST_SITE_ID,
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 1,
        workerCycles: [workerCycle(currentMs - 60_000, 'honest')],
      },
    ] as never
    wire.tribulation = {
      cooldownUntil: currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000,
    }
    wire.decompose = {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
      nextCycleAt: currentMs + 25_000,
      started: true,
    }
    wire.player.lastSavedAt = currentMs

    // Epoch-seconds-shaped authority (server bug / corrupt window): every
    // stamp is finite, |x| < 2^52 - sanitize admits it as a valid cold-boot.
    const authority: RestoreTimeAuthority = {
      kind: 'cold-boot',
      sinceMs: -2_000_000_000_000,
      untilMs: 1_700_000_000, // ~2023-11 in SECONDS, not ms - reads as 1970-01-20
    }

    const reader = registeredManager()
    const readerPlayer = createDefaultPlayer()
    reader.setActivePlayer(readerPlayer)
    reader.saveOps.restoreFromSave(wire, authority)

    // restoreClockMs = min(1.7e9, Date.now()=1.7e12) = 1.7e9 - every honest
    // stamp (~1.7e12) post-dates it, so every deadline re-anchors at ~1970.
    const job2 = reader.alchemySystem.getJobs()[0]!
    expect(job2.startedAtMs).toBe(1_700_000_000)
    expect(job2.completesAtMs).toBe(1_700_000_000 + span)
    expect(job2.completesAtMs).toBeLessThan(currentMs)

    const cycle2 = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(cycle2.startedAtMs).toBe(1_700_000_000)
    expect(cycle2.completesAtMs).toBeLessThan(currentMs)

    const cooldown2 = reader.tribulationDirector.serializeRuntime().cooldownUntil
    expect(cooldown2).toBe(1_700_000_000 + TRIBULATION_COOLDOWN_SECONDS * 1000)
    expect(cooldown2).toBeLessThan(currentMs)

    const next2 = reader.decomposeSystem.getSaveState().nextCycleAt
    expect(next2).toBeLessThan(currentMs)

    // And the grants land on the FIRST tick after restore:
    const bag = new PillBag()
    reader.alchemySystem.tick(currentMs, bag, (id) => ({ id }), () => 0)
    expect(
      reader.alchemySystem.drainSettlementEvents()[0]!.delivered,
    ).toBeGreaterThanOrEqual(1)
  })

  it('F6 honest skewed stamp under a real server until: over-fires by at most the skew (bounded, documented)', () => {
    // A client written +30min ahead of the server approval end: the shift
    // fires on the honest stamp too - pays the cycle skew-early.
    const skew = 30 * 60_000
    const system = createProductionSystem()
    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(currentMs + skew, 'skewed')],
        },
      ],
      currentMs, // restoreClockMs = server until = real-now
    )
    const shifted = system.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(shifted.startedAtMs).toBe(currentMs)
    // Pays `skew` earlier than authored - bounded by the skew itself.
    expect(shifted.completesAtMs).toBe(currentMs + MORTAL_CYCLE_MS)
  })

  it('F7 high-side asymmetry: a far-future until is pinned by Date.now() - only the LOW side is unguarded', () => {
    const system = createProductionSystem()
    // untilMs = 4e15 passes sanitize (|x| < 2^52 ~ 4.5e15) but min() caps
    // the restore clock at Date.now() - honest stamps untouched.
    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(currentMs - 60_000, 'honest')],
        },
      ],
      Math.min(4_000_000_000_000_000, Date.now()),
    )
    const restored = system.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(restored.startedAtMs).toBe(currentMs - 60_000)
  })
})

describe('auditR27 COR probe - reservation verify order / envelope escape (G)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('G1 verifyAlchemyJobReservation throws TypeError when reservation.specialIngredients is absent', () => {
    const { job, recipe } = mortalJob(currentMs - 60_000, 'r27_g1')
    // Crafted witness: object-shaped reservation, valid costScale, no
    // specialIngredients key at all - the digest fold dereferences .map
    // before the Array.isArray check at AlchemySystem.ts:235.
    const crafted = {
      ...job,
      reservation: { costScale: 1, digest: 0 },
    }
    expect(() => verifyAlchemyJobReservation(crafted, recipe)).toThrow(TypeError)
  })

  it('G2 driveSave converts the validator throw into a codeless adapterThrow - the armed envelope is bypassed', async () => {
    const { service } = mockService('remote-authoritative')
    const coordinator = new CloudSaveCoordinator(service)

    const { job } = mortalJob(currentMs - 60_000, 'r27_g2')
    const snapshot = validWireSave()
    snapshot.player.lastSavedAt = currentMs
    // Wire-form reservation drops the specialIngredients key (undefined
    // does not survive JSON round-trip) - a self-consistent-looking job.
    const wireJob = JSON.parse(
      JSON.stringify({ ...job, reservation: { ...job.reservation!, specialIngredients: undefined } }),
    )
    snapshot.alchemyJobs = [wireJob]

    const result = await coordinator.save(snapshot)
    // The armed refuse (code:SAVE_INVALID -> 'recovery') never fires -
    // validateGameSaveShape threw, so callers resolve with the adapter-
    // throw shape: code undefined -> authorityStateForError maps to
    // 'reconnecting' (pause + retry churn), the exact failure mode r26
    // eliminated for deterministic-invalid payloads.
    expect(result.status).toBe('unavailable')
    expect(result.retryable).toBe(false)
    expect((result as { code?: string }).code).toBeUndefined()
    expect((result as { detail?: string }).detail).toBe('SAVE_ADAPTER_THROW')
  })
})

describe('auditR27 COR probe - collection-cap sibling sweep (C)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('C1 every r26-capped channel refuses >1024 entries with a cap issue at the collection path', () => {
    const bigMap = (): Record<string, number> => {
      const m: Record<string, number> = {}
      for (let i = 0; i < 1025; i += 1) m[`k_${i}`] = 1
      return m
    }

    const cases: Array<{
      label: string
      mutate: (wire: GameSave) => void
      path: string
      messageMayDiffer?: boolean
    }> = [
      {
        label: 'player.baseStats',
        mutate: (w) => {
          w.player.baseStats = bigMap() as never
        },
        path: 'player.baseStats',
      },
      {
        label: 'player.skillCastCounts',
        mutate: (w) => {
          w.player.skillCastCounts = bigMap() as never
        },
        path: 'player.skillCastCounts',
      },
      {
        label: 'player.nodeFreePurchaseRecord',
        mutate: (w) => {
          w.player.nodeFreePurchaseRecord = bigMap()
        },
        path: 'player.nodeFreePurchaseRecord',
      },
      {
        label: 'player.hiddenBeastKills',
        mutate: (w) => {
          ;(w.player as unknown as Record<string, unknown>).hiddenBeastKills = bigMap()
        },
        path: 'player.hiddenBeastKills',
      },
      {
        label: 'player.hiddenPerfection.hiddenBreakthroughRealmIds',
        mutate: (w) => {
          ;(w.player as unknown as Record<string, unknown>).hiddenPerfection = {
            hiddenBreakthroughRealmIds: Array.from({ length: 1025 }, (_v, i) => `realm_${i}`),
          }
        },
        path: 'player.hiddenPerfection.hiddenBreakthroughRealmIds',
      },
      {
        label: 'player.nodeOneShotGrants.<id>.learnedSkillIds',
        mutate: (w) => {
          w.player.nodeOneShotGrants = {
            node_x: {
              learnedSkillIds: Array.from({ length: 1025 }, (_v, i) => `skill_${i}`),
            },
          } as never
        },
        // Note: this channel fails with the generic 'phải là mảng string'
        // message - the >1024 arm shares one issue text with malformed
        // entries (it is the only arm that can fire on an all-strings
        // array, so the path evidence still proves the cap).
        path: 'player.nodeOneShotGrants.node_x.learnedSkillIds',
        messageMayDiffer: true,
      },
      {
        label: 'productionSites[0].hiddenChannelCycles',
        mutate: (w) => {
          w.productionSites = [
            {
              siteId: FOREST_SITE_ID,
              level: 1,
              autoRestart: true,
              activeWorkerSlots: 0,
              hiddenChannelCycles: bigMap(),
            },
          ] as never
        },
        path: 'productionSites[0].hiddenChannelCycles',
      },
    ]

    for (const { label, mutate, path, messageMayDiffer } of cases) {
      const wire = validWireSave()
      mutate(wire)
      const shape = validateGameSaveShape(JSON.parse(JSON.stringify(wire)) as GameSave)
      const capIssue = messageMayDiffer
        ? shape.issues.find((issue) => issue.path === path)
        : shape.issues.find(
            (issue) => issue.path === path && issue.message.includes('ID_COLLECTION_CAP'),
          )
      expect(capIssue, `${label} must carry a cap issue`).toBeDefined()
      expect(shape.ok, `${label} must fail admission`).toBe(false)
    }
  })

  it('C2 talentLevels - the one uncovered Record<string,number> - walks 1025 entries without a cap', () => {
    const bigTalents: Record<string, number> = {}
    for (let i = 0; i < 1025; i += 1) bigTalents[`talent_${i}`] = 1

    const wire = validWireSave()
    wire.player.talentLevels = bigTalents
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(wire)) as GameSave)

    // No cap refusal at the collection root - every sibling map gained
    // ID_COLLECTION_CAP this batch; talentLevels iterates all 1025 keys
    // per-entry instead.
    const capIssues = shape.issues.filter(
      (issue) =>
        issue.path === 'player.talentLevels' && issue.message.includes('ID_COLLECTION_CAP'),
    )
    expect(capIssues).toHaveLength(0)

    // The unbounded walk did run: per-entry issues exist for unknown ids.
    expect(
      shape.issues.some((issue) => issue.path.startsWith('player.talentLevels.talent_')),
    ).toBe(true)
  })
})
