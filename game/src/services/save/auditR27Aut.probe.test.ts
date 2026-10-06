// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameSave, RestoreTimeAuthority } from './saveTypes'
import { sanitizeRestoreAuthority } from './saveTypes'
import { buildGameSave, importSaveRaw } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { validateRecoveryData } from './recoveryApi'
import { resolveSaveKey } from './saveKeys'
import { CloudSaveCoordinator } from '../cloudSave/CloudSaveCoordinator'
import type { CloudSaveService } from '../cloudSave/CloudSaveService'
import { LocalCloudSaveService } from '../cloudSave/LocalCloudSaveService'
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
import { PillBag } from '../../core/pill/PillBag'
import { EventBus } from '../../core/events/EventBus'
import {
  TribulationDirector,
  TRIBULATION_COOLDOWN_SECONDS,
} from '../../core/tribulation/TribulationDirector'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { ProductionSystem } from '../../core/production/ProductionSystem'
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
import { calculateOfflineTime, DEFAULT_MAX_OFFLINE_SECONDS } from '../../core/idle/GameClock'
import { usePlayerStore } from '../../stores/player'

// ============================================================================
// QA probe - fixpoint r27 AUT wave. Adversarial audit of the r26 + r27-COR
// batches at 7bea330a:
//
//   (A) CONFIRMED - verifyAlchemyJobReservation still throws through the
//       admission gate: the r27 Array.isArray arm covers a NON-ARRAY
//       specialIngredients, but null/undefined ELEMENTS reach
//       alchemyJobReservationDigest's `.map(special => `${special.materialId}
//       :${special.amount}`)` and throw TypeError - escaping the classified
//       data-refuse envelope at every validateGameSaveShape seam:
//         remote committed row / pending-journal replay (unguarded calls at
//           SupabaseCloudSaveService.ts:748 / :441 -> coordinator.load() ->
//           bootGame's catch-less try -> unhandled rejection -> permanent
//           loading-screen wedge, no export/delete recovery surface),
//         local slot (LocalCloudSaveService.load catches as 'unavailable'
//           - misclassified, recovery surface never offered),
//         driveSave (adapterThrow -> codeless non-retryable 'unavailable',
//           misses the DATA_REFUSE_CODES arm),
//         importSaveRaw / validateRecoveryData (throw inside the FileReader
//           onload - silent no-op, no error toast).
//   (R) REJECTED hypothesis controls - the fix claims hold:
//         began-pair shift bounds post-dated stamps at the restore clock
//           (span exact, no forever-park, no mint),
//         cooldownUntil / nextCycleAt clamps bite,
//         restoreClockMs excludes authority (corrupt-LOW untilMs cannot
//           re-anchor honest stamps),
//         the raw elapsed window is uncapped by design but EVERY consumer
//           applies its own cap (production 10h, decompose 10h+5000,
//           autofarm 24h, cultivation 24h),
//         sanitizeRestoreAuthority degrade arms,
//         ID_COLLECTION_CAP sweep complete (talentLevels + learnedSkillIds
//           distinct messages).
// ============================================================================

const FOREST_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.forest
const MORTAL_CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['mortal'] ?? 100, 1) * 1000
const BOUND_2_52 = 2 ** 52

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

/** A replay-valid job (self-consistent witness), then corrupted at the
 *  specialIngredients seam with caller-supplied elements. */
function craftedJob(
  specialElements: unknown[],
  lastSavedAt: number,
): ReturnType<typeof alchemyJobFixture> {
  const recipe = mortalRecipe()
  const span = alchemySecondsFor(recipe, 1) * 1000
  const job = alchemyJobFixture(
    {
      jobId: 'aut_job',
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId: recipe.herbVariants[0]!.materialId,
      startedAtMs: lastSavedAt - 60_000,
      completesAtMs: lastSavedAt - 60_000 + span,
      roomLevelAtStart: 1,
    },
    undefined,
    recipe,
  )
  return {
    ...job,
    reservation: { ...job.reservation, specialIngredients: specialElements },
  } as ReturnType<typeof alchemyJobFixture>
}

/** Valid save carrying one crafted alchemy job. `wire` controls whether the
 *  payload went through JSON (undefined elements fold to null there) - the
 *  stored/envelope path always sees wire form, the in-memory arm keeps raw
 *  elements. */
function craftedSave(specialElements: unknown[], wire = false): unknown {
  const save = validWireSave() as unknown as Record<string, unknown>
  save['alchemyJobs'] = [craftedJob(specialElements, currentMs)]
  return wire ? JSON.parse(JSON.stringify(save)) : save
}

describe('auditR27 AUT - F-ALCH-THROW: element-class bypass of the r27 guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('A1 r27 fix arm verified: NON-ARRAY specialIngredients reports a field, never throws', () => {
    for (const malformed of [undefined, null, 5, 'x', {}]) {
      // `specialIngredients` IS the malformed value here (not wrapped in an
      // array) - this is the arm r27-COR-2 repaired.
      const job = craftedJob(malformed as unknown[], currentMs)

      const badField = verifyAlchemyJobReservation(job as never, mortalRecipe(), new Set([1]))
      expect(badField).toBe('specialIngredients')

      const save = validWireSave() as unknown as Record<string, unknown>
      save['alchemyJobs'] = [JSON.parse(JSON.stringify(job))]
      let result: ReturnType<typeof validateGameSaveShape> | undefined
      expect(() => {
        result = validateGameSaveShape(save)
      }).not.toThrow()
      expect(result!.ok).toBe(false)
    }
  })

  it('A2 CONFIRMED: specialIngredients [null] throws TypeError through validateGameSaveShape', () => {
    expect(() => validateGameSaveShape(craftedSave([null]))).toThrow(TypeError)
  })

  it('A3 CONFIRMED: [undefined] element throws (and JSON wire form folds undefined -> null)', () => {
    // In-memory object reaches the validator raw: undefined element throws.
    expect(() => validateGameSaveShape(craftedSave([undefined]))).toThrow(TypeError)
    // The wire form stores [null] - same throw on the load gate.
    expect(() => validateGameSaveShape(craftedSave([undefined], true))).toThrow(TypeError)
  })

  it('A4 CONFIRMED: mixed [null, realSpecial] still throws (first bad element decides)', () => {
    const recipe = mortalRecipe()
    const realSpecial = (recipe.specialIngredients ?? [])[0] ?? { materialId: 'mat_x', amount: 1 }
    expect(() =>
      validateGameSaveShape(craftedSave([null, realSpecial])),
    ).toThrow(TypeError)
  })

  it('A5 control: object elements fold fine - self-consistent digest reaches recipe binding and refuses cleanly', () => {
    const recipe = mortalRecipe()
    const span = alchemySecondsFor(recipe, 1) * 1000
    const jobCore = {
      jobId: 'aut_obj',
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId: recipe.herbVariants[0]!.materialId,
      startedAtMs: currentMs - 60_000,
      completesAtMs: currentMs - 60_000 + span,
      roomLevelAtStart: 1,
    }
    const reservation = {
      woodId: 'ghost_wood',
      fuelWoodAmount: 1,
      spiritStoneCost: 1,
      herbAmount: 1,
      specialIngredients: [{ materialId: 'ghost_material', amount: 1 }],
      costScale: 1,
    }
    const job = {
      ...jobCore,
      reservation: {
        ...reservation,
        digest: alchemyJobReservationDigest(jobCore, reservation),
      },
    }
    const save = validWireSave() as unknown as Record<string, unknown>
    save['alchemyJobs'] = [job]

    let result: ReturnType<typeof validateGameSaveShape> | undefined
    expect(() => {
      result = validateGameSaveShape(save)
    }).not.toThrow()
    expect(result!.ok).toBe(false)
    expect(
      result!.issues.some((issue) => String(issue.path).includes('alchemyJobs')),
    ).toBe(true)
  })
})

describe('auditR27 AUT - F-ALCH-THROW seam evidence (classified-refuse escapes)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('B1 driveSave: validator throw -> codeless non-retryable unavailable (DATA_REFUSE arm missed)', async () => {
    const { service } = mockService('local')
    const coordinator = new CloudSaveCoordinator(service)
    const crafted = craftedSave([null]) as GameSave

    const result = await coordinator.save(crafted)

    expect(result.status).toBe('unavailable')
    expect(result.retryable).toBe(false)
    expect(result.detail).toBe('SAVE_ADAPTER_THROW')
    // THE GAP: the armed refuse envelope requires a DATA_REFUSE code; the
    // adapter-throw path carries none, so persistPlayer never escalates to
    // the corrupted surface - it reads as a transient backend failure.
    expect((result as { code?: string }).code).toBeUndefined()
    expect(DATA_REFUSE_CODES.has((result as { code?: string }).code as never)).toBe(false)
  })

  it('B2 local slot: poisoned save misclassifies as storage-unavailable, recovery surface never offered', async () => {
    const craftedRaw = JSON.stringify(craftedSave([null], true))
    const store = new Map<string, string>([[resolveSaveKey(), craftedRaw]])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    })

    const service = new LocalCloudSaveService()
    const loaded = await service.load()

    // loadGame() -> inspectLocalSave() throws the TypeError; the service's
    // blanket catch degrades it to 'unavailable' - NOT 'corrupted', so boot
    // shows a generic failure instead of the export/delete surface while the
    // poisoned slot re-wedges every boot.
    expect(loaded.status).toBe('unavailable')
    expect(loaded.status === 'corrupted').toBe(false)
  })

  it('B3 importSaveRaw throws on the crafted file (uncaught into FileReader onload)', () => {
    expect(() => importSaveRaw(JSON.stringify(craftedSave([null], true)))).toThrow(TypeError)
  })

  it('B4 validateRecoveryData throws on the crafted file (same silent import seam)', () => {
    expect(() => validateRecoveryData(JSON.stringify(craftedSave([null], true)))).toThrow(
      TypeError,
    )
  })

  it('B5 mechanic: the digest fold itself dereferences elements before any shape arm', () => {
    const recipe = mortalRecipe()
    const span = alchemySecondsFor(recipe, 1) * 1000
    const jobCore = {
      jobId: 'aut_fold',
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId: recipe.herbVariants[0]!.materialId,
      startedAtMs: currentMs - 60_000,
      completesAtMs: currentMs - 60_000 + span,
      roomLevelAtStart: 1,
    }
    const reservation = {
      woodId: 'w',
      fuelWoodAmount: 1,
      spiritStoneCost: 1,
      herbAmount: 1,
      specialIngredients: [null],
      costScale: 1,
    }
    expect(() => alchemyJobReservationDigest(jobCore, reservation as never)).toThrow(TypeError)
    // The sibling witness fold (witnessDigest join) never throws - the defect
    // is specifically the .map element deref in the alchemy fold.
    expect(
      verifyAlchemyJobReservation(
        { ...jobCore, reservation: { ...reservation, specialIngredients: 'x', digest: 0 } } as never,
        recipe,
      ),
    ).toBe('specialIngredients')
  })
})

describe('auditR27 AUT - rejected hypotheses (fix claims hold)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('R1 production: a crafted near-2^52 post-dated cycle re-grounds at restoreNow - no forever-park', () => {
    const system = createProductionSystem()
    const craftedStart = BOUND_2_52 - 2 * 86_400_000 // deepest craftable began stamp

    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          assignedWorkers: 1,
          workerCycles: [
            {
              cycleId: 'crafted_huge',
              siteId: FOREST_SITE_ID,
              collectionRealmId: 'mortal',
              siteLevelAtStart: 1,
              rewardTableVersion: 1,
              rollSeed: 1,
              startedAtMs: craftedStart,
              completesAtMs: craftedStart + MORTAL_CYCLE_MS,
            },
          ],
        },
      ],
      currentMs,
    )

    const cycle = system.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(cycle.startedAtMs).toBe(currentMs)
    expect(cycle.completesAtMs).toBe(currentMs + MORTAL_CYCLE_MS)
    // The next write stamps lastSavedAt ~ now: shifted pair sits BELOW it -
    // no self-brick and no instant completion (span preserved).
    expect(cycle.completesAtMs).toBeGreaterThan(cycle.startedAtMs)
  })

  it('R2 alchemy: shifted pair re-derives the digest - witness replays, no free settle', () => {
    const recipe = mortalRecipe()
    const span = alchemySecondsFor(recipe, 1) * 1000
    // startedAtMs = currentMs + 60_000 (post-dated - shiftable arm).
    const job = craftedJob([], currentMs + 120_000)
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([job as never], currentMs)
    const shifted = reader.alchemySystem.getJobs()[0]!

    expect(shifted.startedAtMs).toBe(currentMs)
    expect(shifted.completesAtMs).toBe(currentMs + span)
    expect(verifyAlchemyJobReservation(shifted, recipe)).toBeNull()

    // Early tick pays nothing; the job settles only at its shifted deadline.
    const bag = new PillBag()
    reader.alchemySystem.tick(currentMs + 1_000, bag, (id) => ({ id }), () => 0)
    expect(reader.alchemySystem.drainSettlementEvents()).toHaveLength(0)
    reader.alchemySystem.tick(currentMs + span, bag, (id) => ({ id }), () => 0)
    expect(reader.alchemySystem.drainSettlementEvents()).toHaveLength(1)
  })

  it('R3 tribulation: cooldownUntil past restoreNow+authored clamps to the bound', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })

    director.restoreRuntime(
      { cooldownUntil: currentMs + BOUND_2_52 } as never,
      currentMs,
    )

    expect(director.getCooldownSeconds(currentMs)).toBe(TRIBULATION_COOLDOWN_SECONDS)
    expect(director.getCooldownSeconds(currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000)).toBe(0)
  })

  it('R4 decompose: nextCycleAt clamps at restoreNow+cycleMs and stays monotonic', () => {
    const system = new DecomposeSystem(new MaterialBag(), { cycleSeconds: 30 })

    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs + 10 * 86_400_000,
        started: true,
      },
      currentMs,
    )
    expect(system.getSaveState().nextCycleAt).toBe(currentMs + 30_000)

    // A second restore cannot drag the timer backwards (no mint via re-restore).
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: 0,
        started: true,
      },
      currentMs - 86_400_000,
    )
    expect(system.getSaveState().nextCycleAt).toBe(currentMs + 30_000)
  })

  it('R5 r27-COR-1: corrupt-LOW authority does NOT re-anchor began stamps (authority excluded)', () => {
    const save = validWireSave()
    const lastSavedAt = save.player.lastSavedAt ?? currentMs
    const recipe = mortalRecipe()
    const span = alchemySecondsFor(recipe, 1) * 1000
    const job = alchemyJobFixture(
      {
        jobId: 'r5_job',
        recipeId: recipe.id,
        pillId: recipe.pillId,
        herbMaterialId: recipe.herbVariants[0]!.materialId,
        startedAtMs: lastSavedAt - 1_000,
        completesAtMs: lastSavedAt - 1_000 + span,
        roomLevelAtStart: 1,
      },
      undefined,
      recipe,
    )
    save.alchemyJobs = [job]
    save.productionSites = [
      {
        siteId: FOREST_SITE_ID,
        level: 1,
        autoRestart: true,
        workerCycles: [workerCycle(lastSavedAt - 1_000, 'r5_cycle')],
      },
    ]

    const authority: RestoreTimeAuthority = {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: 1.7e9, // seconds-for-millis unit corruption - formally valid (< 2^52)
    }
    const reader = registeredManager()
    reader.saveOps.restoreFromSave(save, authority)

    // The corrupt authority does NOT re-anchor: stamps keep the payload epoch,
    // and the deny direction holds - the job stays in-flight (settleNowMs
    // clamps to the corrupt until), no instant-completion mint.
    const restoredJob = reader.alchemySystem.getJobs()[0]!
    expect(restoredJob.startedAtMs).toBe(lastSavedAt - 1_000)
    expect(restoredJob.completesAtMs).toBe(lastSavedAt - 1_000 + span)
    const restoredCycle = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(restoredCycle.startedAtMs).toBe(lastSavedAt - 1_000)
    expect(restoredCycle.completesAtMs).toBe(lastSavedAt - 1_000 + MORTAL_CYCLE_MS)
    expect(reader.alchemySystem.getJobs()).toHaveLength(1)
  })

  it('R6 corrupt-HIGH authority: raw window is uncapped by design, but every consumer caps', () => {
    const lastSavedAt = currentMs - 60_000
    const authority: RestoreTimeAuthority = {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: lastSavedAt + 1e13, // ~317 years - formally valid (< 2^52)
    }

    // The shared window primitive resolves uncapped (deliberate - consumers cap).
    const raw = calculateOfflineTime(
      { lastOnlineAt: authority.kind === 'cold-boot' ? authority.sinceMs : lastSavedAt },
      authority.untilMs as number,
      Number.POSITIVE_INFINITY,
    )
    expect(raw.offlineSeconds).toBeGreaterThan(1e9)

    // The cultivation payout path applies DEFAULT_MAX_OFFLINE_SECONDS (24h).
    const store = usePlayerStore()
    const save = validWireSave()
    save.player.lastSavedAt = lastSavedAt
    const offline = store.restoreFromSave(save, authority)
    expect(offline.elapsedSeconds).toBe(DEFAULT_MAX_OFFLINE_SECONDS)
    expect(offline.elapsedSeconds).toBe(86_400)
  })

  it('R7 sanitizeRestoreAuthority degrade arms: null/unknown-kind/NaN/overflow -> deny primitive', () => {
    expect(sanitizeRestoreAuthority(undefined)).toBeUndefined()

    for (const corrupt of [
      null,
      { kind: 'bogus' },
      { kind: 'cold-boot', sinceMs: Number.NaN, untilMs: currentMs },
      { kind: 'cold-boot', sinceMs: currentMs, untilMs: BOUND_2_52 }, // |x| >= 2^52
      { kind: 'live-replacement', nowMs: Number.POSITIVE_INFINITY },
    ]) {
      const sanitized = sanitizeRestoreAuthority(corrupt as never)
      expect(sanitized?.kind).toBe('live-replacement')
      expect(sanitized?.kind === 'live-replacement' ? sanitized.nowMs : 0).toBe(currentMs)
    }

    const honest: RestoreTimeAuthority = { kind: 'cold-boot', sinceMs: 1, untilMs: 2 }
    expect(sanitizeRestoreAuthority(honest)).toBe(honest)
  })

  it('R8 cap sweep: talentLevels >1024 refuses, learnedSkillIds arms carry distinct messages', () => {
    const save = validWireSave() as unknown as {
      player: { talentLevels: Record<string, number>; nodeOneShotGrants: Record<string, unknown> }
    }

    save.player.talentLevels = Object.fromEntries(
      Array.from({ length: 1025 }, (_, i) => [`talent_${i}`, 1]),
    )
    const capped = validateGameSaveShape(save)
    expect(capped.ok).toBe(false)
    expect(
      capped.issues.some(
        (issue) => issue.path === 'player.talentLevels' && String(issue.message).includes('1024'),
      ),
    ).toBe(true)

    // Distinct learnedSkillIds arms: non-array -> 'mang string'; >1024 -> cap;
    // non-string element -> 'mang string'.
    const grant = (learnedSkillIds: unknown) => ({ learnedSkillIds })
    save.player.talentLevels = {}
    save.player.nodeOneShotGrants = { node_a: grant('not-an-array') }
    const nonArray = validateGameSaveShape(save)
    expect(
      nonArray.issues.some((issue) =>
        String(issue.path).includes('learnedSkillIds') && String(issue.message).includes('mảng'),
      ),
    ).toBe(true)

    save.player.nodeOneShotGrants = {
      node_a: grant(Array.from({ length: 1025 }, (_, i) => `skill_${i}`)),
    }
    const overCap = validateGameSaveShape(save)
    expect(
      overCap.issues.some((issue) =>
        String(issue.path).includes('learnedSkillIds') && String(issue.message).includes('1024'),
      ),
    ).toBe(true)
  })

  it('R9 DATA_REFUSE_CODES arms exactly the two data-class refuses', () => {
    expect([...DATA_REFUSE_CODES].sort()).toEqual(['SAVE_INVALID', 'SAVE_TOO_LARGE'])
  })

  it('R10 tribulation witness: non-object witness reports a field, never throws', () => {
    const save = validWireSave() as unknown as Record<string, unknown>
    save['tribulation'] = {
      committedOutcome: {
        attemptId: 1,
        outcome: 'victory',
        targetRealmId: 'qi_refining',
        grade: 'human',
        breakthroughType: 'standard',
        witness: null,
        receipt: null,
        settlementError: false,
      },
    }

    let result: ReturnType<typeof validateGameSaveShape> | undefined
    expect(() => {
      result = validateGameSaveShape(save)
    }).not.toThrow()
    expect(result!.ok).toBe(false)
    expect(result!.issues.some((issue) => String(issue.path).includes('witness'))).toBe(true)
  })
})
