// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import { sanitizeRestoreAuthority, type GameSave } from './saveTypes'
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

// ============================================================================
// QA probe - fixpoint r28 COR wave. Audits the r26 + r27 batches at 1582467f:
//
//   (A) restoreJobs shifted-arm throw: the r27-INT-Low normalize arm tolerates
//       non-array specialIngredients on the RETURN clause, but a post-dated
//       job with a defined-but-malformed reservation still hits
//       alchemyJobReservationDigest first and throws TypeError - the same
//       payload class survives on one arm and crashes on the sibling.
//       Ungated callers only (admission pins the reservation shape AND
//       startedAtMs <= lastSavedAt). Reported as Low.
//   (B) restore-clock boundaries: exact-boundary semantics on the tribulation
//       /decompose clamps and the negative-marker arm of min(lastSavedAt,
//       Date.now()) - the began-pair shift is pure arithmetic, no floor.
//   (V) fail-closed validator: an internal defect converts to a refused
//       verdict ({ok:false, path:'', 'validator gap loi noi bo'}), and a
//       legit wire payload still validates (regression).
//   (C) collection-cap order: exactly-1024 carries no cap issue (boundary),
//       learnedSkillIds distinct messages (shape arm vs cap arm), and the
//       sanitizeRestoreAuthority |2^52| / sign / kind-whitelist sweep.
//   (D) negative marker end-to-end: player.lastSavedAt admits negatives
//       (isBoundedTimestamp, no >=0 arm - sibling deadline stamps use the
//       non-negative variant); restoreClock then = the deep-past marker and
//       the began-pair shift behaves deterministically under it.
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

beforeEach(() => {
  setActivePinia(createPinia())
  currentMs = 1_725_160_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('auditR28 COR probe - restoreJobs shifted-arm throw asymmetry (A)', () => {
  it('A1 post-dated job + reservation null: re-derive arm skips the fold - normalize arm still runs', () => {
    const { job } = mortalJob(currentMs + 60_000, 'r28_a1')
    const reader = registeredManager()

    // r28-COR-Low fixed: a defined-but-malformed reservation is not
    // foldable, so the shift arm skips the digest re-derive instead of
    // throwing - the normalize arm then survives it like the verbatim
    // arm always did.
    expect(() =>
      reader.alchemySystem.restoreJobs(
        [{ ...job, reservation: null }] as never,
        currentMs,
      ),
    ).not.toThrow()
    expect(reader.alchemySystem.getJobs()[0]!.reservation).toEqual({
      specialIngredients: [],
    })
  })

  it('A1b post-dated job + reservation.specialIngredients = {}: same converge - shift arm no longer throws', () => {
    const { job } = mortalJob(currentMs + 60_000, 'r28_a1b')
    const reader = registeredManager()

    // The non-foldable witness skips re-derive (digest stays writer
    // stale - deny direction since shifted stamps mismatch it), and
    // the specials field normalizes to [].
    expect(() =>
      reader.alchemySystem.restoreJobs(
        [
          {
            ...job,
            reservation: { ...job.reservation!, specialIngredients: {} },
          },
        ] as never,
        currentMs,
      ),
    ).not.toThrow()
    const restored = reader.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(currentMs)
    expect(restored.reservation!.specialIngredients).toEqual([])
  })

  it('A2 converged: the SAME malformed payloads normalize silently on either arm (verbatim shown)', () => {
    const { job } = mortalJob(currentMs - 60_000, 'r28_a2')
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs(
      [
        {
          ...job,
          reservation: { ...job.reservation!, specialIngredients: {} },
        },
      ] as never,
      currentMs,
    )
    expect(reader.alchemySystem.getJobs()[0]!.reservation?.specialIngredients).toEqual([])

    const reader2 = registeredManager()
    reader2.alchemySystem.restoreJobs([{ ...job, reservation: null }] as never, currentMs)
    // {...null} yields {} then specials normalize to [] - survives.
    expect(reader2.alchemySystem.getJobs()[0]!.reservation).toEqual({
      specialIngredients: [],
    })
  })

  it('A3 boundary: began == restoreNow does NOT shift - the writer digest is preserved verbatim', () => {
    const { job } = mortalJob(currentMs, 'r28_a3')
    const writerDigest = job.reservation!.digest
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([job], currentMs)
    const restored = reader.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(currentMs)
    expect(restored.reservation!.digest).toBe(writerDigest)
  })

  it('A4 shifted job re-derives the digest (differs from writer stamp) and it still replays', () => {
    const { job, recipe } = mortalJob(currentMs + 60_000, 'r28_a4')
    const writerDigest = job.reservation!.digest
    const reader = registeredManager()

    reader.alchemySystem.restoreJobs([job], currentMs)
    const restored = reader.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(currentMs)
    expect(restored.reservation!.digest).not.toBe(writerDigest)
    expect(restored.reservation!.digest).toBe(
      alchemyJobReservationDigest(restored, restored.reservation!),
    )
    expect(verifyAlchemyJobReservation(restored, recipe)).toBeNull()
  })
})

describe('auditR28 COR probe - restore-clock boundaries (B)', () => {
  it('B1 negative restore clock: pairs <= clock stay deep-past, > clock re-ground at the marker', () => {
    const marker = -1_000_000_000_000
    const system = createProductionSystem()

    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 3,
          workerCycles: [
            workerCycle(marker - 5_000, 'deep'),
            workerCycle(marker, 'edge'),
            workerCycle(marker + 60_000, 'post'),
          ],
        },
      ],
      marker,
    )

    const byId = new Map(
      system.getState(FOREST_SITE_ID)!.workerCycles!.map((c) => [c.cycleId, c]),
    )
    // The shift arm is pure arithmetic - no 0-floor, no non-negative pin.
    expect(byId.get('deep')!.startedAtMs).toBe(marker - 5_000)
    expect(byId.get('deep')!.completesAtMs).toBe(marker - 5_000 + MORTAL_CYCLE_MS)
    expect(byId.get('edge')!.startedAtMs).toBe(marker)
    expect(byId.get('post')!.startedAtMs).toBe(marker)
    expect(byId.get('post')!.completesAtMs).toBe(marker + MORTAL_CYCLE_MS)
  })

  it('B2 tribulation: cooldownUntil == restoreNow + authored span kept; +1ms clamps to the bound', () => {
    const bound = currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000

    const exact = new TribulationDirector({ eventBus: new EventBus() })
    exact.restoreRuntime({ cooldownUntil: bound }, currentMs)
    expect(exact.serializeRuntime().cooldownUntil).toBe(bound)

    const over = new TribulationDirector({ eventBus: new EventBus() })
    over.restoreRuntime({ cooldownUntil: bound + 1 }, currentMs)
    expect(over.serializeRuntime().cooldownUntil).toBe(bound)
  })

  it('B3 decompose: nextCycleAt == restoreNow + cycleMs kept; +1ms clamps to the bound', () => {
    const cycleSeconds = 30
    const bound = currentMs + cycleSeconds * 1000

    const exact = new DecomposeSystem(new MaterialBag(), { cycleSeconds })
    exact.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: bound,
        started: true,
      },
      currentMs,
    )
    expect(exact.getSaveState().nextCycleAt).toBe(bound)

    const over = new DecomposeSystem(new MaterialBag(), { cycleSeconds })
    over.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: bound + 1,
        started: true,
      },
      currentMs,
    )
    expect(over.getSaveState().nextCycleAt).toBe(bound)
  })
})

describe('auditR28 COR probe - fail-closed validator (V)', () => {
  it('V1 an internal defect converts to the refused verdict - never throws', () => {
    // A throwing getter stands in for an internal validator defect: plain
    // JSON payloads cannot carry getters, so any checked-body throw is by
    // definition internal (r27-AUT-1 contract).
    const hostile = {
      get player(): never {
        throw new Error('simulated validator defect')
      },
    }

    const shape = validateGameSaveShape(hostile as never)
    expect(shape.ok).toBe(false)
    expect(shape.issues).toEqual([
      { path: '', message: 'validator gặp lỗi nội bộ' },
    ])
    expect(shape.discardedEquipmentCount).toBe(0)
    if (shape.ok) {
      expect.unreachable('internal defect must refuse, never normalize')
    }
  })

  it('V2 regression: a legit writer-produced wire save still validates', () => {
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(validWireSave())))
    expect(shape.ok).toBe(true)
    expect(shape.issues).toHaveLength(0)
  })
})

describe('auditR28 COR probe - collection-cap order + authority boundaries (C)', () => {
  it('C1 exactly-1024-entry collections carry no cap issue', () => {
    const at1024 = (): Record<string, number> => {
      const m: Record<string, number> = {}
      for (let i = 0; i < 1024; i += 1) m[`k_${i}`] = 1
      return m
    }

    const wireA = validWireSave()
    wireA.player.talentLevels = at1024()
    const shapeA = validateGameSaveShape(JSON.parse(JSON.stringify(wireA)) as GameSave)
    expect(
      shapeA.issues.some(
        (issue) =>
          issue.path === 'player.talentLevels' &&
          issue.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(false)

    const wireB = validWireSave()
    wireB.player.skillCastCounts = at1024() as never
    const shapeB = validateGameSaveShape(JSON.parse(JSON.stringify(wireB)) as GameSave)
    expect(
      shapeB.issues.some(
        (issue) =>
          issue.path === 'player.skillCastCounts' &&
          issue.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(false)

    const wireC = validWireSave()
    wireC.player.nodeOneShotGrants = {
      node_x: {
        learnedSkillIds: Array.from({ length: 1024 }, (_v, i) => `skill_${i}`),
      },
    } as never
    const shapeC = validateGameSaveShape(JSON.parse(JSON.stringify(wireC)) as GameSave)
    expect(
      shapeC.issues.some(
        (issue) => issue.path === 'player.nodeOneShotGrants.node_x.learnedSkillIds',
      ),
    ).toBe(false)
  })

  it('C2 learnedSkillIds arm ordering: non-array vs over-cap vs non-string-element messages', () => {
    const grantWith = (learnedSkillIds: unknown) => {
      const wire = validWireSave()
      wire.player.nodeOneShotGrants = {
        node_x: { learnedSkillIds },
      } as never
      return JSON.parse(JSON.stringify(wire)) as GameSave
    }
    const path = 'player.nodeOneShotGrants.node_x.learnedSkillIds'

    const nonArray = validateGameSaveShape(grantWith({}))
    expect(
      nonArray.issues.some(
        (issue) => issue.path === path && issue.message === 'phải là mảng string',
      ),
    ).toBe(true)

    const overCap = validateGameSaveShape(
      grantWith(Array.from({ length: 1025 }, (_v, i) => `skill_${i}`)),
    )
    expect(
      overCap.issues.some(
        (issue) =>
          issue.path === path && issue.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(true)
    expect(
      overCap.issues.some(
        (issue) => issue.path === path && issue.message === 'phải là mảng string',
      ),
    ).toBe(false)

    const badElement = validateGameSaveShape(grantWith(['ok_id', 5]))
    expect(
      badElement.issues.some(
        (issue) => issue.path === path && issue.message === 'phải là mảng string',
      ),
    ).toBe(true)
  })

  it('C3 sanitizeRestoreAuthority: |2^52| boundary, sign admitted, kind whitelist, null -> deny', () => {
    const POW52 = 2 ** 52
    const deny = { kind: 'live-replacement', nowMs: currentMs }

    // Absent stays absent; nullish-but-present denies.
    expect(sanitizeRestoreAuthority(undefined)).toBeUndefined()
    expect(sanitizeRestoreAuthority(null as never)).toEqual(deny)

    // |stamp| < 2^52 admits (both signs); the boundary itself denies.
    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: POW52 - 1 }),
    ).toEqual({ kind: 'live-replacement', nowMs: POW52 - 1 })
    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: POW52 }),
    ).toEqual(deny)
    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: -POW52 }),
    ).toEqual(deny)
    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: -1_700_000_000 }),
    ).toEqual({ kind: 'live-replacement', nowMs: -1_700_000_000 })
    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: Number.NaN }),
    ).toEqual(deny)
    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: Number.POSITIVE_INFINITY }),
    ).toEqual(deny)

    // Unknown kind denies; cold-boot denies on ANY bad stamp.
    expect(
      sanitizeRestoreAuthority({ kind: 'other', nowMs: 1 } as never),
    ).toEqual(deny)
    expect(
      sanitizeRestoreAuthority({ kind: 'cold-boot', sinceMs: 1, untilMs: Number.NaN }),
    ).toEqual(deny)
    expect(
      sanitizeRestoreAuthority({ kind: 'cold-boot', sinceMs: 1_000, untilMs: 2_000 }),
    ).toEqual({ kind: 'cold-boot', sinceMs: 1_000, untilMs: 2_000 })
  })
})

describe('auditR28 COR probe - negative marker end-to-end (D)', () => {
  it('D1 admission: negative player.lastSavedAt produces no issue at the marker path', () => {
    const wire = validWireSave()
    wire.player.lastSavedAt = -1_000_000_000_000
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(wire)) as GameSave)

    // isBoundedTimestamp (|x| < 2^52, no >=0 arm) admits it - sibling
    // deadline stamps (decompose.nextCycleAt, tribulation.cooldownUntil,
    // lastDailyResetAtMs) use the non-negative variant. Deny-equivalent:
    // the deep-past marker only shrinks every re-domain bound.
    expect(
      shape.issues.some((issue) => issue.path === 'player.lastSavedAt'),
    ).toBe(false)
  })

  it('D2 restoreFromSave under a negative marker: restoreClock = marker, began-pair shift is deterministic', () => {
    const marker = -1_000_000_000_000
    const writer = registeredManager()
    const writerPlayer = createDefaultPlayer()
    writer.setActivePlayer(writerPlayer)
    primeMortalCreationPick(writerPlayer, writer.skillManager)
    const wire = JSON.parse(JSON.stringify(buildGameSave(writerPlayer, writer))) as GameSave

    wire.player.lastSavedAt = marker
    wire.productionSites = [
      {
        siteId: FOREST_SITE_ID,
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 2,
        workerCycles: [
          workerCycle(marker - 5_000, 'pre'), // began before the marker: stays
          workerCycle(marker + 60_000, 'post'), // began past the marker: shifts
        ],
      },
    ] as never

    const reader = registeredManager()
    const readerPlayer = createDefaultPlayer()
    reader.setActivePlayer(readerPlayer)
    // live-replacement authority => elapsedOfflineSeconds = 0: the >60s
    // offline settle stays off and the restored stamps remain observable
    // (a cold-boot/undefined authority would derive a giant elapsed from
    // the deep-past marker and consume the cycles inside it).
    reader.saveOps.restoreFromSave(wire, {
      kind: 'live-replacement',
      nowMs: currentMs,
    })

    const byId = new Map(
      reader.productionSystem
        .getState(FOREST_SITE_ID)!
        .workerCycles!.map((c) => [c.cycleId, c]),
    )
    expect(byId.get('pre')!.startedAtMs).toBe(marker - 5_000)
    expect(byId.get('post')!.startedAtMs).toBe(marker)
    expect(byId.get('post')!.completesAtMs).toBe(marker + MORTAL_CYCLE_MS)
  })
})
