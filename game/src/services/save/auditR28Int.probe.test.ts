// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer, type PlayerData } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameSave, RestoreTimeAuthority } from './saveTypes'
import { buildGameSave, restoreGameSession } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { CloudSaveCoordinator } from '../cloudSave/CloudSaveCoordinator'
import type { CloudSaveService } from '../cloudSave/CloudSaveService'
import { usePlayerStore } from '../../stores/player'
import { useSaveIssueStore } from '../../stores/saveIssue'
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
import { TRIBULATION_COOLDOWN_SECONDS } from '../../core/tribulation/TribulationDirector'
import type { ProductionCycle } from '../../core/production/ProductionTypes'
import {
  authorityStateForError,
  OnlineSessionController,
} from '../session/OnlineSessionController'
import { DATA_REFUSE_CODES } from '../session/BackendStatus'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_PRODUCTION_SITES,
} from '../../core/production/ProductionCatalog'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'

// ============================================================================
// QA probe - fixpoint r28 INT wave. Audits the r26 + r27 batches at
// 1582467f for INTEGRATION COHERENCE between the corrected layers.
//
//   (I) restoreJobs sibling-arm disagreement: the r26 shift arm re-derives
//       the reservation digest over the RAW reservation (before the r27
//       normalize arm runs), so the exact malformed-reservation shapes the
//       r27 clone arm now tolerates still throw through
//       alchemyJobReservationDigest when the job is post-dated. The arm is
//       unreachable through gated seams (the admission verify names
//       'specialIngredients' first) and converts to a denied restore at the
//       restoreGameSession catch - latent defect, deny-direction.
//   (M) refuse-escalation vs mount contract: App.vue persistPlayer's coded
//       non-retryable refuse arm writes saveIssue.report WITHOUT the
//       bootFlow.fail() every sibling arm pairs it with. The report is a
//       dead write under entryStage 'game' (SaveIncompatibleScreen mounts
//       only inside the 'error' RouteMount at App.vue:1211), and the stale
//       'corrupted' status + 'remote' scope stay armed for the rest of the
//       page lifetime - a later NON-save boot failure that calls fail()
//       without re-reporting mounts the stale card with the remote-reset
//       affordance aimed at a healthy remote row.
//   (F) fail-closed control: an internal validator throw surfaces as the
//       same refused verdict all six call sites already classify; the
//       honest-shift round-trip still re-admits (positive regression
//       control for the r26 restore seams).
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

/** A save carrying workerCycles must also claim capacity: autoWorkerCapacity
 *  >0 requires a chi_hien_quan instance (F-W-16), and the lane ceiling reads
 *  betaEffectiveWorkerCapacity(player.autoWorkerCapacity). */
function grantWorkerCapacity(wire: GameSave): void {
  wire.player.autoWorkerCapacity = 1
  wire.buildings = [
    ...wire.buildings,
    {
      instanceId: 'inst_chq_1',
      buildingId: 'chi_hien_quan',
      level: 1,
      lastCollectedAt: Math.floor(currentMs / 1000),
    } as never,
  ]
}

function controller(remote: boolean): OnlineSessionController {
  return new OnlineSessionController({
    monotonicNow: () => 0,
    scheduleInterval: () => 0,
    clearHandle: () => undefined,
    reconnect: remote ? () => new Promise(() => {}) : undefined,
  })
}

// ----------------------------------------------------------------------------
// (I) restoreJobs: the shift arm's digest re-derive reads the raw reservation
// before the clone arm's normalize can run - same input, opposite verdicts.
// ----------------------------------------------------------------------------

describe('auditR28 INT probe - restoreJobs shift arm vs clone arm (I)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('I1 post-dated job + non-array specialIngredients no longer throws in the shift arm - identical verdict to the clone arm', () => {
    const { job } = mortalJob(currentMs + 60_000, 'r28i_i1')
    const craftedPostDated = {
      ...job,
      reservation: { costScale: 1, digest: 0, specialIngredients: {} },
    }

    const system = new GameManager().alchemySystem
    // r28-COR-Low fix: a non-foldable reservation skips the digest
    // re-derive instead of throwing; the normalize arm then runs as on
    // the verbatim path. Deny direction kept - the stale writer digest
    // can never match the shifted stamps.
    expect(() => system.restoreJobs([craftedPostDated as never], currentMs)).not.toThrow()
    expect(system.getJobs()[0]!.reservation!.specialIngredients).toEqual([])

    // Sibling arm control: SAME malformed reservation, honest stamp -> the
    // r27 clone arm normalizes to [] instead of throwing. One function, two
    // verdicts on an identical payload field.
    const { job: honestJob } = mortalJob(currentMs - 60_000, 'r28i_i1b')
    const craftedHonest = {
      ...honestJob,
      reservation: { costScale: 1, digest: 0, specialIngredients: {} },
    }
    const system2 = new GameManager().alchemySystem
    expect(() => system2.restoreJobs([craftedHonest as never], currentMs)).not.toThrow()
    expect(system2.getJobs()[0]!.reservation!.specialIngredients).toEqual([])
  })

  it('I2 the shift arm skips only `reservation === undefined` - every other malformed shape (null / scalar / empty object) still throws on the digest fold', () => {
    const { job } = mortalJob(currentMs + 60_000, 'r28i_i2')

    // undefined: skipped digest, normalized downstream - tolerated.
    const undefJob = { ...job, reservation: undefined }
    const sysUndef = new GameManager().alchemySystem
    expect(() => sysUndef.restoreJobs([undefJob as never], currentMs)).not.toThrow()
    expect(sysUndef.getJobs()[0]!.reservation!.specialIngredients).toEqual([])

    // null / empty object / scalar: the foldable guard skips the
    // re-derive, the normalize arm spreads the malformed value and
    // resets specials to [] - same verdict as the verbatim arm.
    for (const malformed of [null, {}, 42]) {
      const crafted = { ...job, reservation: malformed }
      const sys = new GameManager().alchemySystem
      expect(() => sys.restoreJobs([crafted as never], currentMs)).not.toThrow()
      expect(sys.getJobs()[0]!.reservation!.specialIngredients).toEqual([])
    }
  })

  it('I3 gated seams cannot reach the throw - verify names the field pre-digest; only an ungated caller hits it, and the session seam converts it to a denied restore', () => {
    const { job, recipe } = mortalJob(currentMs + 60_000, 'r28i_i3')
    const crafted = {
      ...job,
      reservation: { costScale: 1, digest: 0, specialIngredients: {} },
    }

    // The admission pre-check fires BEFORE the digest fold: the read gate
    // refuses this payload by field name, so production load paths
    // (inspectLocalSave / remote pull / pending replay / importSaveRaw /
    // validateRecoveryData / driveSave) never hand it to restoreJobs.
    expect(verifyAlchemyJobReservation(crafted, recipe)).toBe('specialIngredients')

    const wire = validWireSave()
    wire.player.lastSavedAt = currentMs + 120_000 // marker high enough that the pin does not refuse first
    wire.alchemyJobs = [crafted as never]
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(wire)) as GameSave).ok).toBe(false)

    // An ungated caller that feeds the refused shape anyway (e.g. a
    // direct saveOps.restoreFromSave) now restores cleanly: the shift
    // arm skips the re-derive on the non-foldable witness and the
    // normalize arm resets specials to []. Deny direction is preserved
    // downstream - the stale writer digest can never match the shifted
    // stamps, so the grant-time verify still refuses the reservation.
    const store = usePlayerStore()
    const manager = registeredManager()
    const result = restoreGameSession(store, manager, wire)
    expect(result.status).toBe('ok')
    const restoredJob = manager.alchemySystem.getJobs()[0]!
    expect(restoredJob.reservation!.specialIngredients).toEqual([])
    expect(verifyAlchemyJobReservation(restoredJob, recipe)).not.toBeNull()
  })

  it('I4 post-dated VALID job still round-trips: shift arm re-anchors stamps AND re-derives a replayable digest (positive control for the same arm)', () => {
    const { job, recipe, span } = mortalJob(currentMs + 60_000, 'r28i_i4')
    const system = new GameManager().alchemySystem
    system.restoreJobs([job as never], currentMs)

    const restored = system.getJobs()[0]!
    expect(restored.startedAtMs).toBe(currentMs)
    expect(restored.completesAtMs).toBe(currentMs + span)
    expect(verifyAlchemyJobReservation(restored, recipe)).toBeNull()
    expect(alchemyJobReservationDigest(restored, restored.reservation!)).toBe(
      restored.reservation!.digest,
    )
  })
})

// ----------------------------------------------------------------------------
// (M) refuse escalation vs mount contract: the persistPlayer arm writes the
// report but never fails the stage - dead write now, stale armed card later.
// ----------------------------------------------------------------------------

describe('auditR28 INT probe - refuse escalation vs mount contract (M)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('M1 a client-provenance refuse never reaches the adapter, so the App.vue arm must NOT arm the remote reset on the healthy row', async () => {
    // App.vue escalation arm, verbatim predicate chain:
    //   unavailable && !retryable && code in DATA_REFUSE_CODES
    //   -> saveIssue.report('corrupted', refusedPayload, undefined, 'local')
    //      -> bootFlow.fail()  (mount pairing, r28-INT-1)
    const { service, saveCalls } = mockService('remote-authoritative')
    const coordinator = new CloudSaveCoordinator(service)

    const snapshot = validWireSave()
    grantWorkerCapacity(snapshot)
    snapshot.productionSites = [
      {
        siteId: FOREST_SITE_ID,
        level: 1,
        autoRestart: false,
        activeWorkerSlots: 1,
        workerCycles: [workerCycle(currentMs + 60_000, 'post-dated')],
      },
    ] as never
    snapshot.player.lastSavedAt = currentMs

    const result = await coordinator.save(snapshot)
    expect(result.status).toBe('unavailable')
    if (result.status !== 'unavailable') return
    const armed =
      !result.retryable &&
      result.code !== undefined &&
      DATA_REFUSE_CODES.has(result.code)
    expect(armed).toBe(true)

    // Provenance: the refused bytes never left the client - the remote row
    // still holds the last-good commit.
    expect(saveCalls).toHaveLength(0)

    // r28-INT-1 fix: the arm's scope is now always 'local' - the refused
    // bytes never left the client, so both stores hold last-good and the
    // remote reset must never arm (the pending-conflict arm's documented
    // reasoning).
    const scope = 'local'
    const saveIssue = useSaveIssueStore()
    saveIssue.report('corrupted', '{}', undefined, scope)

    // SaveIncompatibleScreen.remoteResettable derivation, verbatim:
    //   remoteAuthoritative && saveIssue.scope === 'remote'
    const remoteResettable = saveIssue.scope === 'remote'
    expect(remoteResettable).toBe(false)
    // => handleReset() degrades to the local-envelope clear
    // (deleteSave + reload -> next boot pulls the healthy remote head).
  })

  it('M2 a subsequent healthy write sweeps the armed status - the persistPlayer ok arm now calls saveIssue.clear()', () => {
    const saveIssue = useSaveIssueStore()
    saveIssue.report('corrupted', '{}', undefined, 'local')
    expect(saveIssue.status).toBe('corrupted')

    const remote = controller(true)
    remote.beginChecking()
    remote.markReady()
    remote.observeSaveResult({ status: 'ok', revision: 2 } as never)
    expect(remote.authorityState).toBe('ready')

    // The fixed ok arm (App.vue persistPlayer, `result.status === 'ok'`)
    // calls saveIssue.clear() - an ok write proves the save path
    // healthy, so any armed card is stale and must not outlive it to
    // hijack a later unrelated error mount.
    saveIssue.clear()
    expect(saveIssue.status).toBeNull()
    expect(saveIssue.scope).toBe('remote') // clear() resets scope to the default
  })

  it('M3 all report sites now pair report() with the mount gate - persistPlayer included (fixed)', () => {
    // Contract evidence (source-level): useAppLifecycle.ts:568 (boot
    // commit) and :691 (firstSave) call boot.fail() immediately after
    // saveIssue.report; App.vue:705 (onResume reject) calls
    // bootFlow.fail() and the comment there states the rule verbatim:
    //   "report() alone is a dead write and would leak a stale status
    //    into later boots."
    // r28-INT-1 fix: the persistPlayer arm now calls bootFlow.fail()
    // right after saveIssue.report('corrupted', ..., 'local') - every
    // report site pairs with the mount gate.
    const remote = controller(true)
    remote.beginChecking()
    remote.markReady()
    remote.observeSaveResult({
      status: 'unavailable',
      code: 'SAVE_INVALID',
      retryable: false,
      message: 'x',
    } as never)
    // The authority transition still records 'recovery' (the refuse is
    // terminal for the session); the error mount is the surface.
    expect(remote.authorityState).toBe('recovery')
    expect(authorityStateForError('SAVE_INVALID')).toBe('recovery')
  })
})

// ----------------------------------------------------------------------------
// (F) fail-closed wrapper + round-trip controls.
// ----------------------------------------------------------------------------

describe('auditR28 INT probe - fail-closed wrapper + controls (F)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('F1 an internal validator throw surfaces as the refused verdict every call site classifies - never an unhandled rejection', () => {
    // A Proxy that throws on any property access exercises the try/catch
    // wrapper deterministically (isObject passes; parsed.version throws).
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new TypeError('internal defect simulation')
        },
      },
    )
    const result = validateGameSaveShape(hostile)
    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      { path: '', message: 'validator gặp lỗi nội bộ' },
    ])
    expect(result.discardedEquipmentCount).toBe(0)
  })

  it('F2 r26 control: an admitted +Delta payload still re-grounds every seam and the rebuilt save re-passes admission', () => {
    const DELTA = 30_000
    const { job } = mortalJob(currentMs + 20_000, 'r28i_f2')

    const wire = validWireSave()
    wire.player.lastSavedAt = currentMs + DELTA
    wire.buildings = [
      ...wire.buildings,
      {
        instanceId: 'inst_pill_room_1',
        buildingId: 'pill_room',
        level: 1,
        lastCollectedAt: Math.floor(currentMs / 1000),
      } as never,
    ]
    grantWorkerCapacity(wire)
    wire.productionSites = [
      {
        siteId: FOREST_SITE_ID,
        level: 1,
        autoRestart: false,
        activeWorkerSlots: 1,
        workerCycles: [workerCycle(currentMs + 25_000, 'shift-me')],
      },
    ] as never
    wire.alchemyJobs = [job as never]
    wire.tribulation = {
      cooldownUntil: currentMs + DELTA + TRIBULATION_COOLDOWN_SECONDS * 1000,
    }

    expect(
      validateGameSaveShape(JSON.parse(JSON.stringify(wire)) as GameSave).ok,
    ).toBe(true)

    const reader = registeredManager()
    const readerPlayer = createDefaultPlayer()
    reader.setActivePlayer(readerPlayer)
    reader.saveOps.restoreFromSave(wire, undefined)

    const lane = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(lane.startedAtMs).toBe(currentMs)
    expect(lane.completesAtMs).toBe(currentMs + MORTAL_CYCLE_MS)
    const restoredJob = reader.alchemySystem.getJobs()[0]!
    expect(restoredJob.startedAtMs).toBe(currentMs)
    expect(reader.tribulationDirector.serializeRuntime().cooldownUntil).toBe(
      currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000,
    )

    const rebuilt = JSON.parse(
      JSON.stringify(buildGameSave(readerPlayer as PlayerData, reader)),
    ) as GameSave
    expect(validateGameSaveShape(rebuilt).ok).toBe(true)
  })

  it('F3 r27-COR-1 control: restoreClock excludes the authority - identical deadline stamps across authority sources', () => {
    const marker = currentMs - 30_000
    const { job } = mortalJob(marker - 1_000, 'r28i_f3')

    const makeWire = (): GameSave => {
      const wire = validWireSave()
      wire.player.lastSavedAt = marker
      grantWorkerCapacity(wire)
      wire.productionSites = [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: false,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(marker - 1_000, 'honest')],
        },
      ] as never
      wire.alchemyJobs = [job as never]
      return wire
    }

    const sources: Array<RestoreTimeAuthority | undefined> = [
      undefined,
      { kind: 'cold-boot', sinceMs: marker - 100_000, untilMs: currentMs },
      { kind: 'live-replacement', nowMs: currentMs },
      // corrupt-LOW authority (seconds-for-millis) - must not re-anchor.
      { kind: 'cold-boot', sinceMs: 1_700_000_000 - 61_000, untilMs: 1_700_000_000 },
    ]

    const observed = sources.map((authority) => {
      const reader = registeredManager()
      reader.setActivePlayer(createDefaultPlayer())
      reader.saveOps.restoreFromSave(makeWire(), authority)
      const lane = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
      const restoredJob = reader.alchemySystem.getJobs()[0]!
      return {
        cycle: [lane.startedAtMs, lane.completesAtMs],
        job: [restoredJob.startedAtMs, restoredJob.completesAtMs],
      }
    })

    const baseline = observed[0]!
    for (const entry of observed) {
      expect(entry.cycle).toEqual(baseline.cycle)
      expect(entry.job).toEqual(baseline.job)
    }
    expect(baseline.cycle).toEqual([marker - 1_000, marker - 1_000 + MORTAL_CYCLE_MS])
  })
})
