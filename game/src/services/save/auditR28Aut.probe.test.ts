// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameSave } from './saveTypes'
import { sanitizeRestoreAuthority } from './saveTypes'
import { buildGameSave, restoreGameSession } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from './saveAcceptance'
import { DATA_REFUSE_CODES } from '../session/BackendStatus'
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
import type { ActiveAlchemyJob } from '../../core/alchemy/AlchemySystem'
import { PillBag } from '../../core/pill/PillBag'
import { EventBus } from '../../core/events/EventBus'
import {
  TribulationDirector,
  TRIBULATION_COOLDOWN_SECONDS,
} from '../../core/tribulation/TribulationDirector'
import { commitWitnessFor } from '../../core/tribulation/TribulationCommitWitness.fixture'
import { getTribulationChapters } from '../../data/tribulation/TribulationChapters'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { ProductionSystem } from '../../core/production/ProductionSystem'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import { QuestManager } from '../../core/quest/QuestManager'
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
// QA probe - fixpoint r28 AUT wave. Adversarial audit of the r26 batch +
// r27-COR + r27-AUT/INT fixes at 1582467f: shared restoreClockMs re-domain,
// began-pair shifts with digest re-derivation, cooldown/decompose deadline
// clamps, fail-closed validateGameSaveShape, armed DATA_REFUSE envelope,
// ID_COLLECTION_CAP coverage, sanitizeRestoreAuthority deny primitive.
//
// FINDINGS:
//   F1 (Low) - restore seams still throw TypeError on bypassed payloads:
//     restoreJobs([null]), restoreStates([null]), questManager.restore(null),
//     advanceWorkerLanes({pending:[null]}) each read a field off a null entry
//     before any guard. The sharpest arm is restoreJobs: the r26 shift arm
//     folds alchemyJobReservationDigest over a post-dated job's reservation
//     BEFORE the r27 normalize clone runs - reservation=null / non-object /
//     specialIngredients non-array all .map-throw one branch earlier than
//     the line r27-AUT-2 hardened. Ungated feeds only; restoreGameSession's
//     outer catch degrades any of them to 'rejected' (bounded deny), but one
//     malformed entry wedges the whole restore instead of normalize-
//     restoring the clean slices.
//   F2 (Low) - AlchemySystem.tick/settleOffline lacks the non-finite nowMs
//     guard advanceWorkerLanes carries (r21-COR-2): NaN or 1e300 treats
//     every restored job as due (NaN < completesAtMs is false) and settles
//     the whole queue instantly. Reachable only on an ungated feed (ungated
//     NaN lastSavedAt propagates through ?? and Math.min into settleNowMs;
//     the settleOffline call is unconditional); on that same feed a forged
//     completesAtMs already mints unconditionally, so incremental surface
//     is thin - listed for guard parity with the hardened sibling.
//
// VERIFIED-HELD arms are asserted as positive behavior below.
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

const JOB_RECIPE = alchemyRecipes.find((r) => r.id === 'alchemy_thong_mach_dan')!

function jobAt(startedAtMs: number, jobId: string) {
  return alchemyJobFixture(
    {
      jobId,
      recipeId: JOB_RECIPE.id,
      pillId: JOB_RECIPE.pillId,
      herbMaterialId: JOB_RECIPE.herbVariants[0]!.materialId,
      startedAtMs,
      completesAtMs: startedAtMs + alchemySecondsFor(JOB_RECIPE, 1) * 1000,
      roomLevelAtStart: 1,
    },
    undefined,
    JOB_RECIPE,
  )
}

function makeSave(overrides: { lastSavedAt?: number } = {}): GameSave {
  const manager = registeredManager()
  const player = createDefaultPlayer()
  primeMortalCreationPick(player, manager.skillManager)
  const save = buildGameSave(player, manager)
  save.player.lastSavedAt = overrides.lastSavedAt ?? currentMs
  return save
}

describe('r28-AUT - F1 bypassed-payload TypeError arms: digest-fold fixed; null-element throws are the accepted residual', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // F1a/F1b/F1e/F1f pin the ACCEPTED residual: null-element throws on
  // ungated restore feeds (validator rejects every shape before the sole
  // production caller; restoreGameSession's catch degrades any throw to
  // 'rejected' - bounded deny, never an unhandled boot exception).
  it('F1a: restoreStates throws reading state.siteId on a null entry', () => {
    const system = createProductionSystem()
    expect(() =>
      system.restoreStates([null as unknown as never], currentMs),
    ).toThrow(TypeError)
  })

  it('F1b: restoreJobs throws reading job.startedAtMs on a null entry', () => {
    const reader = registeredManager()
    expect(() =>
      reader.alchemySystem.restoreJobs([null as unknown as ActiveAlchemyJob], currentMs),
    ).toThrow(TypeError)
  })

  it('F1c: a POST-DATED job with reservation:null no longer throws - non-foldable witness skips the re-derive (r28-COR-Low fix)', () => {
    const reader = registeredManager()
    const postDated = {
      ...jobAt(currentMs + 60_000, 'r28_f1c_null'),
      reservation: null,
    } as unknown as ActiveAlchemyJob

    expect(() =>
      reader.alchemySystem.restoreJobs([postDated], currentMs),
    ).not.toThrow()
    expect(reader.alchemySystem.getJobs()[0]!.reservation!.specialIngredients).toEqual([])
  })

  it('F1c-bis: post-dated job + specialIngredients non-array no longer throws - stale digest kept (deny at grant verify)', () => {
    const reader = registeredManager()
    const job = jobAt(currentMs + 60_000, 'r28_f1c_bis')
    const badReservation = {
      ...job.reservation!,
      specialIngredients: {},
    }
    const postDated = {
      ...job,
      reservation: badReservation,
    } as unknown as ActiveAlchemyJob

    expect(() =>
      reader.alchemySystem.restoreJobs([postDated], currentMs),
    ).not.toThrow()
    expect(reader.alchemySystem.getJobs()[0]!.reservation!.specialIngredients).toEqual([])
  })

  it('F1c-ter: post-dated job + specialIngredients:[null] no longer throws - null elements normalize to {}', () => {
    const reader = registeredManager()
    const job = jobAt(currentMs + 60_000, 'r28_f1c_ter')
    const badReservation = {
      ...job.reservation!,
      specialIngredients: [null],
    }
    const postDated = {
      ...job,
      reservation: badReservation,
    } as unknown as ActiveAlchemyJob

    expect(() =>
      reader.alchemySystem.restoreJobs([postDated], currentMs),
    ).not.toThrow()
    expect(reader.alchemySystem.getJobs()[0]!.reservation!.specialIngredients).toEqual([{}])
  })

  it('F1d contrast: the SAME malformed reservations on a NON-post-dated job do not throw (r27 clone arm alone tolerates them)', () => {
    const reader = registeredManager()
    const inFlightNull = {
      ...jobAt(currentMs - 60_000, 'r28_f1d_null'),
      reservation: null,
    } as unknown as ActiveAlchemyJob
    const jobBadSpecials = jobAt(currentMs - 60_000, 'r28_f1d_specials')
    const inFlightBadSpecials = {
      ...jobBadSpecials,
      reservation: { ...jobBadSpecials.reservation!, specialIngredients: {} },
    } as unknown as ActiveAlchemyJob

    expect(() =>
      reader.alchemySystem.restoreJobs([inFlightNull, inFlightBadSpecials], currentMs),
    ).not.toThrow()

    const jobs = reader.alchemySystem.getJobs()
    expect(jobs).toHaveLength(2)
    for (const restored of jobs) {
      expect(restored.reservation!.specialIngredients).toEqual([])
    }
  })

  it('F1e: questManager.restore(null) throws reading state.active', () => {
    const manager = new QuestManager()
    expect(() => manager.restore(null as unknown as never, currentMs)).toThrow(TypeError)
  })

  it('F1f: advanceWorkerLanes throws inside its own zero-advance guard on pending:[null] (the .some predicate reads cycle.* unguarded)', () => {
    expect(() =>
      advanceWorkerLanes({
        siteId: FOREST_SITE_ID,
        collectionRealmId: 'mortal',
        siteLevel: 1,
        baseSeconds: CYCLE_BASE_SECONDS_BY_REALM['mortal'] ?? 100,
        cycleMs: MORTAL_CYCLE_MS,
        slots: 1,
        nowMs: currentMs,
        pending: [null as unknown as ProductionCycle],
        advanceMode: 'deadline',
        budgetMs: 3_600_000,
      }),
    ).toThrow(TypeError)

    // Contrast: a malformed-but-object entry zero-advances cleanly.
    const safe = advanceWorkerLanes({
      siteId: FOREST_SITE_ID,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: CYCLE_BASE_SECONDS_BY_REALM['mortal'] ?? 100,
      cycleMs: MORTAL_CYCLE_MS,
      slots: 1,
      nowMs: currentMs,
      pending: [
        {
          ...workerCycle(currentMs - 1, 'bad-span'),
          completesAtMs: currentMs - 2, // reversed span -> zero-advance
        },
      ],
      advanceMode: 'deadline',
      budgetMs: 3_600_000,
    })
    expect(safe.completed).toEqual([])
    expect(safe.pending).toHaveLength(1)
  })

  it('F1-envelope: through restoreGameSession a gated-seam failure degrades to a handled rejected result, never an unhandled boot throw', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    // A shape-valid save that fails the acceptance preflight (unknown
    // material ref) exercises the same 'rejected' envelope a mid-restore
    // seam throw lands in via the body catch (SaveSystem.ts:316-322) -
    // both degrade to the corrupted-save surface, never propagate.
    const save = makeSave()
    save.materials.push({ materialId: 'r28_forged_material', amount: 1 })

    let result: ReturnType<typeof restoreGameSession> | undefined
    expect(() => {
      result = restoreGameSession(player, manager, save)
    }).not.toThrow()
    expect(result).toMatchObject({ status: 'rejected' })
  })
})

describe('r28-AUT - F2: alchemy tick/settleOffline finite-clock guard (fixed - zero-advance parity)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('F2a: tick(NaN) zero-advances - the r28-AUT-2 finite-clock guard preserves the in-flight job', () => {
    const reader = registeredManager()
    const job = jobAt(currentMs - 60_000, 'r28_f2a') // in-flight: completes at now + span - 60s
    reader.alchemySystem.restoreJobs([job], currentMs)
    expect(reader.alchemySystem.getJobs()).toHaveLength(1)

    const bag = new PillBag()
    reader.alchemySystem.tick(NaN, bag, (id) => ({ id }), () => 0)

    expect(reader.alchemySystem.drainSettlementEvents()).toHaveLength(0)
    expect(bag.getAmount(JOB_RECIPE.pillId)).toBe(0)
    expect(reader.alchemySystem.getJobs()).toHaveLength(1)
  })

  it('F2b: tick(+-1e300) both zero-advance - guard parity with advanceWorkerLanes (deny direction)', () => {
    for (const clock of [1e300, -1e300]) {
      const reader = registeredManager()
      reader.alchemySystem.restoreJobs([jobAt(currentMs - 60_000, `r28_f2b_${clock}`)], currentMs)
      const bag = new PillBag()
      reader.alchemySystem.tick(clock, bag, (id) => ({ id }), () => 0)
      expect(reader.alchemySystem.drainSettlementEvents()).toHaveLength(0)
      expect(bag.getAmount(JOB_RECIPE.pillId)).toBe(0)
      expect(reader.alchemySystem.getJobs()).toHaveLength(1)
    }
  })

  it('F2c contrast: advanceWorkerLanes zero-advances on the same non-finite clocks', () => {
    const pending = [workerCycle(currentMs - 1_000, 'f2c')]
    for (const clock of [NaN, 1e300, -1e300]) {
      const out = advanceWorkerLanes({
        siteId: FOREST_SITE_ID,
        collectionRealmId: 'mortal',
        siteLevel: 1,
        baseSeconds: CYCLE_BASE_SECONDS_BY_REALM['mortal'] ?? 100,
        cycleMs: MORTAL_CYCLE_MS,
        slots: 1,
        nowMs: clock,
        pending,
        advanceMode: 'deadline',
        budgetMs: 3_600_000,
      })
      expect(out.completed).toEqual([])
      expect(out.pending).toHaveLength(1)
    }
  })
})

describe('r28-AUT - verified-held fix arms', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('V1 restoreStates: post-dated pair re-grounds at restoreNowMs with span preserved; honest and boundary pairs untouched', () => {
    const system = createProductionSystem()
    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 4,
          workerCycles: [
            workerCycle(currentMs + 60_000, 'post'),
            workerCycle(currentMs - 5_000, 'flight'),
            workerCycle(currentMs, 'edge'),
          ],
        },
      ],
      currentMs,
    )
    const byId = new Map(
      system.getState(FOREST_SITE_ID)!.workerCycles!.map((c) => [c.cycleId, c]),
    )
    expect(byId.get('post')!.startedAtMs).toBe(currentMs)
    expect(byId.get('post')!.completesAtMs).toBe(currentMs + MORTAL_CYCLE_MS)
    expect(byId.get('flight')!.startedAtMs).toBe(currentMs - 5_000)
    expect(byId.get('flight')!.completesAtMs).toBe(currentMs - 5_000 + MORTAL_CYCLE_MS)
    expect(byId.get('edge')!.startedAtMs).toBe(currentMs)
  })

  it('V2 restoreJobs: shifted job re-derives the reservation digest - witness still replays and settles', () => {
    const job = jobAt(currentMs + 60_000, 'r28_v2')
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([job], currentMs)
    const shifted = reader.alchemySystem.getJobs()[0]!
    const span = alchemySecondsFor(JOB_RECIPE, 1) * 1000

    expect(shifted.startedAtMs).toBe(currentMs)
    expect(shifted.completesAtMs).toBe(currentMs + span)
    expect(verifyAlchemyJobReservation(shifted, JOB_RECIPE)).toBeNull()
    expect(alchemyJobReservationDigest(shifted, shifted.reservation!)).toBe(
      shifted.reservation!.digest,
    )
  })

  it('V3 tribulation cooldownUntil: honest kept, beyond-authored clamps at restoreNow+span, Infinity clamps, NaN stores NaN (deny-equivalent: the start gate reads false)', () => {
    const honest = new TribulationDirector({ eventBus: new EventBus() })
    honest.restoreRuntime({ cooldownUntil: currentMs + 60_000 }, currentMs)
    expect(honest.serializeRuntime().cooldownUntil).toBe(currentMs + 60_000)

    const skewed = new TribulationDirector({ eventBus: new EventBus() })
    skewed.restoreRuntime(
      { cooldownUntil: currentMs + 3_600_000 + TRIBULATION_COOLDOWN_SECONDS * 1000 },
      currentMs,
    )
    expect(skewed.serializeRuntime().cooldownUntil).toBe(
      currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000,
    )

    const infinite = new TribulationDirector({ eventBus: new EventBus() })
    infinite.restoreRuntime({ cooldownUntil: Number.POSITIVE_INFINITY }, currentMs)
    expect(infinite.serializeRuntime().cooldownUntil).toBe(
      currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000,
    )

    // Ungated NaN arm: Math.min(NaN, bound) = NaN internally, and
    // serializeRuntime guards `cooldownUntil > 0` so the NaN never
    // persists - equivalent to a legitimately-admissible cooldownUntil=0
    // (no cooldown), the same effect a crafted slice already gets.
    const nan = new TribulationDirector({ eventBus: new EventBus() })
    nan.restoreRuntime({ cooldownUntil: NaN }, currentMs)
    expect(nan.serializeRuntime().cooldownUntil).toBeUndefined()
  })

  it('V4 decompose nextCycleAt: honest kept, beyond-cap clamps at restoreNow+cycleMs, NaN keeps live timer', () => {
    const system = new DecomposeSystem(new MaterialBag(), { cycleSeconds: 30 })
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs + 10_000,
        started: true,
      },
      currentMs,
    )
    expect(system.getSaveState().nextCycleAt).toBe(currentMs + 10_000)

    const clamped = new DecomposeSystem(new MaterialBag(), { cycleSeconds: 30 })
    clamped.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs + 86_400_000,
        started: true,
      },
      currentMs,
    )
    expect(clamped.getSaveState().nextCycleAt).toBe(currentMs + 30_000)

    const nan = new DecomposeSystem(new MaterialBag(), { cycleSeconds: 30 })
    nan.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: NaN,
        started: true,
      },
      currentMs,
    )
    expect(Number.isNaN(nan.getSaveState().nextCycleAt)).toBe(false)
  })

  it('V5 validateGameSaveShape is fail-closed: a throwing property access inside the checked body returns a refused verdict', () => {
    const poisoned = {
      version: 0,
      get player(): unknown {
        throw new Error('poisoned getter')
      },
    } as unknown
    const shape = validateGameSaveShape(poisoned)
    expect(shape.ok).toBe(false)
    expect(shape.issues.length).toBeGreaterThan(0)
    expect(shape.issues[shape.issues.length - 1]!.path).toBe('')
  })

  it('V6 sanitizeRestoreAuthority degrades every out-of-domain stamp to the zero-accrual deny primitive; only absent stays absent', () => {
    // absent (undefined) = no authority provided -> legacy local
    // semantics, strictly undefined-only (r26-COR-N1).
    expect(sanitizeRestoreAuthority(undefined)).toBeUndefined()

    for (const authority of [
      null,
      'cold-boot',
      { kind: 'cold-boot' },
      { kind: 'cold-boot', sinceMs: NaN, untilMs: currentMs },
      { kind: 'cold-boot', sinceMs: currentMs, untilMs: 2 ** 52 },
      { kind: 'cold-boot', sinceMs: currentMs, untilMs: -(2 ** 52) },
      { kind: 'cold-boot', sinceMs: 1, untilMs: Infinity },
      { kind: 'bogus', sinceMs: 1, untilMs: 2 },
      { kind: 'live-replacement', nowMs: NaN },
    ]) {
      const out = sanitizeRestoreAuthority(authority as never)
      expect(out).toMatchObject({ kind: 'live-replacement' })
    }

    // A well-formed authority passes through untouched.
    const honest = {
      kind: 'cold-boot' as const,
      sinceMs: currentMs - 60_000,
      untilMs: currentMs,
    }
    expect(sanitizeRestoreAuthority(honest)).toBe(honest)
  })

  it('V7 DATA_REFUSE_CODES covers exactly the data-class refuses', () => {
    expect(DATA_REFUSE_CODES.has('SAVE_INVALID')).toBe(true)
    expect(DATA_REFUSE_CODES.has('SAVE_TOO_LARGE')).toBe(true)
    expect(DATA_REFUSE_CODES.size).toBe(2)
  })

  it('V8 isSaveAcceptable is a boolean envelope - registry violations return false, never throw', () => {
    const save = makeSave()
    save.materials.push({ materialId: 'r28_forged_material', amount: 1 })
    expect(() =>
      isSaveAcceptable(save, staticSaveAcceptanceCatalogs()),
    ).not.toThrow()
    expect(isSaveAcceptable(save, staticSaveAcceptanceCatalogs())).toBe(false)
    // Sanity: the untampered save is acceptable.
    expect(isSaveAcceptable(makeSave(), staticSaveAcceptanceCatalogs())).toBe(true)
  })

  it('V9 deep-past lastSavedAt (-4e15): all dues settle inside the same bounded window as an honest cap - no unbounded mint', () => {
    // Direct mechanism probe of the offline budget bound: a lane whose
    // dues all sit at -4e15 completes at most budgetMs worth of cycles.
    const deepPast = -4e15
    const out = advanceWorkerLanes({
      siteId: FOREST_SITE_ID,
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: CYCLE_BASE_SECONDS_BY_REALM['mortal'] ?? 100,
      cycleMs: MORTAL_CYCLE_MS,
      slots: 2,
      nowMs: currentMs,
      pending: [workerCycle(deepPast, 'deep-0'), workerCycle(deepPast, 'deep-1')],
      emptyLaneStartMs: deepPast,
      advanceMode: 'deadline',
      budgetMs: 10 * 3_600_000, // PRODUCTION_OFFLINE_CAP_SECONDS
    })
    // Bounded mint: paid dues cannot exceed budget/cycleMs per lane +
    // the one persisted head each.
    const maxPaid = 2 * (Math.floor((10 * 3_600_000) / MORTAL_CYCLE_MS) + 1)
    expect(out.completed.length).toBeLessThanOrEqual(maxPaid)
    expect(out.consumedBudgetMs).toBeLessThanOrEqual(10 * 3_600_000)
    // All remaining dues forfeit - the chain does not mint into infinity.
    expect(Number.isFinite(out.consumedBudgetMs)).toBe(true)
  })

  it('V10 tribulation committedOutcome: settlementError:true skips ONLY the realm binding - the witness must still replay', () => {
    // Player realm 'mortal' vs departingRealmId 'qi_refining': a live
    // record must fail the binding (unsettled realm write), a terminal-
    // failed record skips it (mid-apply state is unknowable). Both still
    // need a replay-valid witness to pass admission at all.
    const chapters = getTribulationChapters('qi_refining')!
    const baseFields = {
      attemptId: 1,
      outcome: 'victory' as const,
      targetRealmId: 'qi_refining',
      grade: 'human' as const,
      breakthroughType: 'normal' as const,
      departingRealmId: 'qi_refining',
      chapterIndex: chapters.length - 1,
      chaptersTotal: chapters.length,
      lightningStrikesTaken: 0,
      attemptSeed: 1,
    }

    const saveLive = makeSave() as unknown as Record<string, unknown>
    saveLive['tribulation'] = {
      committedOutcome: {
        ...baseFields,
        witness: commitWitnessFor(baseFields).witness,
        receipt: null,
        settlementError: false,
      },
    }
    const shapeLive = validateGameSaveShape(saveLive)
    expect(shapeLive.ok).toBe(false)
    expect(
      shapeLive.issues.some((issue) =>
        String(issue.path).includes('departingRealmId'),
      ),
    ).toBe(true)

    const saveError = makeSave() as unknown as Record<string, unknown>
    saveError['tribulation'] = {
      committedOutcome: {
        ...baseFields,
        witness: commitWitnessFor(baseFields).witness,
        receipt: null,
        settlementError: true,
      },
    }
    const shapeError = validateGameSaveShape(saveError)
    expect(shapeError.ok).toBe(true)

    // And at restore the skipped binding cannot resurrect the record:
    // settlementError rehydrates to a terminal-failed marker whose
    // settle arm returns null before any witness/apply work (deny).
    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime(
      {
        committedOutcome: {
          ...baseFields,
          witness: commitWitnessFor(baseFields).witness,
          receipt: null,
          settlementError: true,
        },
      },
      currentMs,
    )
    const committed = director.getCommittedOutcome()
    expect(committed).not.toBeNull()
    expect(committed!.settlementError).not.toBeNull()
    expect(committed!.receipt).toBeNull()
  })
})
