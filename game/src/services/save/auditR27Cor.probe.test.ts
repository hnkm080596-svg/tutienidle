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
//   (F) restoreClock floor: restoreClockMs is now min(lastSavedAt,
//       Date.now()) - authority no longer participates (r27 adjudication
//       of R27-COR-1). A formally-valid but corrupt-LOW authority stamp
//       (epoch-seconds unit confusion, stale/corrupt server window) can
//       only deny accrual; it cannot re-anchor honest stamps into
//       instant-completion grants. The remaining skew arm (marker past
//       device-now, indistinguishable from crafted +Delta) is the
//       documented residual: stamps shift to now+span, paying skew-early.
//   (G) verify order: verifyAlchemyJobReservation now shape-checks
//       reservation.specialIngredients BEFORE the digest fold (r27
//       adjudication of R27-COR-2) - a malformed witness reports its
//       field, the driveSave refuse is the armed SAVE_INVALID envelope,
//       and no adapter-throw escape remains.
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
  return {
    job,
    recipe,
    span,
    fixture: withReservation
      ? job
      : ({ ...job, reservation: undefined } as unknown as typeof job),
  }
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

  it('F1 production: corrupt-low authority cannot drag the bound below the marker - honest cycle heads restore verbatim', () => {
    // r27-COR-1 fixed: the restore clock is min(lastSavedAt, Date.now())
    // - authority plays no role. A formally-valid but corrupt-LOW
    // cold-boot untilMs can only deny accrual, never re-anchor.
    const writer = registeredManager()
    const writerPlayer = createDefaultPlayer()
    writer.setActivePlayer(writerPlayer)
    primeMortalCreationPick(writerPlayer, writer.skillManager)
    const wire = JSON.parse(JSON.stringify(buildGameSave(writerPlayer, writer))) as GameSave
    wire.player.lastSavedAt = currentMs
    wire.productionSites = [
      {
        siteId: FOREST_SITE_ID,
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 1,
        workerCycles: [workerCycle(currentMs - 60_000, 'honest')],
      },
    ] as never

    const reader = registeredManager()
    const readerPlayer = createDefaultPlayer()
    reader.setActivePlayer(readerPlayer)
    reader.saveOps.restoreFromSave(wire, {
      kind: 'cold-boot',
      sinceMs: -2_000_000_000_000,
      untilMs: 1_700_000_000, // seconds-for-millis corrupt stamp - reads as 1970
    })

    const cycle = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(cycle.startedAtMs).toBe(currentMs - 60_000)
    expect(cycle.completesAtMs).toBe(currentMs - 60_000 + MORTAL_CYCLE_MS)
  })

  it('F2 alchemy: corrupt-low authority leaves the reserved job in-flight (digest replays, no instant payout)', () => {
    const { job, recipe } = mortalJob(currentMs - 60_000, 'r27_f2')
    const writer = registeredManager()
    const writerPlayer = createDefaultPlayer()
    writer.setActivePlayer(writerPlayer)
    primeMortalCreationPick(writerPlayer, writer.skillManager)
    const wire = JSON.parse(JSON.stringify(buildGameSave(writerPlayer, writer))) as GameSave
    wire.player.lastSavedAt = currentMs
    wire.alchemyJobs = [job as never]

    const reader = registeredManager()
    const readerPlayer = createDefaultPlayer()
    reader.setActivePlayer(readerPlayer)
    reader.saveOps.restoreFromSave(wire, {
      kind: 'cold-boot',
      sinceMs: -2_000_000_000_000,
      untilMs: 1_700_000_000,
    })

    const restored = reader.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(currentMs - 60_000)
    expect(restored.completesAtMs).toBeGreaterThan(currentMs)
    expect(verifyAlchemyJobReservation(restored, recipe)).toBeNull()

    const bag = new PillBag()
    reader.alchemySystem.tick(currentMs, bag, (id) => ({ id }), () => 0)
    expect(reader.alchemySystem.drainSettlementEvents()).toHaveLength(0)
  })

  it('F3 tribulation: corrupt-low authority keeps the authored cooldown', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })
    // Caller-side: min(marker, now) - marker is honest so the clamp
    // bound is the marker, not the corrupt stamp. Honest cooldown
    // (marker + span) restores verbatim at the authored bound.
    director.restoreRuntime(
      { cooldownUntil: currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000 },
      currentMs,
    )
    const restored = director.serializeRuntime()
    expect(restored.cooldownUntil).toBe(currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000)
  })

  it('F4 decompose: corrupt-low authority keeps nextCycleAt at its authored due', () => {
    const system = new DecomposeSystem(new MaterialBag(), { cycleSeconds: 30 })
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs + 25_000,
        started: true,
      },
      currentMs,
    )
    const next = system.getSaveState().nextCycleAt
    expect(next).toBe(currentMs + 25_000)
    expect(next).toBeGreaterThan(currentMs)
  })

  it('F5 integration: real saveOps.restoreFromSave under corrupt-low cold-boot restores all four channels verbatim', () => {
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

    // r27-COR-1 fixed: restoreClockMs = min(lastSavedAt, Date.now()) =
    // currentMs - the corrupt 1.7e9 authority stamp only denies the
    // accrual window; it can no longer re-anchor honest stamps. Every
    // channel restores verbatim.
    const job2 = reader.alchemySystem.getJobs()[0]!
    expect(job2.startedAtMs).toBe(currentMs - 60_000)
    expect(job2.completesAtMs).toBe(currentMs - 60_000 + span)
    expect(job2.completesAtMs).toBeGreaterThan(currentMs)

    const cycle2 = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(cycle2.startedAtMs).toBe(currentMs - 60_000)
    expect(cycle2.completesAtMs).toBe(currentMs - 60_000 + MORTAL_CYCLE_MS)

    const cooldown2 = reader.tribulationDirector.serializeRuntime().cooldownUntil
    expect(cooldown2).toBe(currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000)

    const next2 = reader.decomposeSystem.getSaveState().nextCycleAt
    expect(next2).toBe(currentMs + 25_000)

    // And the first tick pays NOTHING early - the corrupt authority only
    // shrunk the accrual window, never minted in-flight work.
    const bag = new PillBag()
    reader.alchemySystem.tick(currentMs, bag, (id) => ({ id }), () => 0)
    expect(reader.alchemySystem.drainSettlementEvents()).toHaveLength(0)
  })

  it('F6 skewed began-time under a past-now marker: span-preserving shift, bounded by the skew (documented residual)', () => {
    // r27-COR-4 residual: a save whose own marker reads past device-now
    // (fast clock fixed backward, or a crafted +Delta marker - the two
    // shapes are indistinguishable) still shifts its >now stamps to
    // now+span: the cycle completes skew-early. Bounded by the skew,
    // deny-side alternative (idle till Delta) re-opens the self-brick.
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
      currentMs, // restoreClockMs = min(marker, now) = device now
    )
    const shifted = system.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(shifted.startedAtMs).toBe(currentMs)
    // Pays `skew` earlier than authored - bounded by the skew itself.
    expect(shifted.completesAtMs).toBe(currentMs + MORTAL_CYCLE_MS)
  })

  it('F7 high-side asymmetry: a far-future marker is pinned by Date.now() - the LOW side cannot mint either', () => {
    const system = createProductionSystem()
    // min(marker, now): a far-future marker (+Delta craft) yields bound
    // = device-now, so >now stamps still ground at now; a corrupt-low
    // authority no longer participates at all (F1-F5).
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
    // r27-COR-2 fixed: the shape check precedes the digest fold, so a
    // malformed witness reports its field instead of throwing.
    expect(verifyAlchemyJobReservation(crafted, recipe)).toBe('specialIngredients')
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
    // r27-COR-2 fixed: the malformed witness is now a validation issue,
    // not a throw - the refuse is the armed data-class envelope
    // (SAVE_INVALID -> 'recovery'), no adapter-throw escape.
    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.retryable).toBe(false)
    }
    expect((result as { code?: string }).code).toBe('SAVE_INVALID')
    expect((result as { detail?: string }).detail).toBe('OUTGOING_ADMISSION_REJECTED')
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
        path: 'player.nodeOneShotGrants.node_x.learnedSkillIds',
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

  it('C2 talentLevels now shares the collection root cap - 1025 keys refuse before the entry walk', () => {
    const bigTalents: Record<string, number> = {}
    for (let i = 0; i < 1025; i += 1) bigTalents[`talent_${i}`] = 1

    const wire = validWireSave()
    wire.player.talentLevels = bigTalents
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(wire)) as GameSave)

    // r27-COR-3 fixed: the last uncapped Record now refuses on count at
    // the collection root, before iterating entries.
    const capIssues = shape.issues.filter(
      (issue) =>
        issue.path === 'player.talentLevels' && issue.message.includes('ID_COLLECTION_CAP'),
    )
    expect(capIssues).toHaveLength(1)
    expect(shape.ok).toBe(false)

    // The unbounded walk no longer runs: no per-entry issues.
    expect(
      shape.issues.some((issue) => issue.path.startsWith('player.talentLevels.talent_')),
    ).toBe(false)
  })
})
