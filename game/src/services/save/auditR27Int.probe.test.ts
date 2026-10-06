// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer, type PlayerData } from '../../core/player/Player'
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
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import { TRIBULATION_COOLDOWN_SECONDS } from '../../core/tribulation/TribulationDirector'
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
import type { ProductionCycle } from '../../core/production/ProductionTypes'
import {
  authorityStateForError,
  OnlineSessionController,
} from '../session/OnlineSessionController'
import { DATA_REFUSE_CODES } from '../session/BackendStatus'

// ============================================================================
// QA probe - fixpoint r27 INT wave. Audits the r26 + r27-COR batches at
// 7bea330a for INTEGRATION COHERENCE: do the corrected layers agree with
// each other at every seam?
//
//   (R) round-trip: a formally-admitted +Delta-marker payload re-grounds all
//       four deadline channels at min(marker, device-now) through the real
//       saveOps seam, and the rebuilt save re-passes the SAME admission -
//       the self-brick class is closed end to end.
//   (A) authority-source matrix: undefined / honest cold-boot /
//       live-replacement / corrupt-LOW cold-boot converge on IDENTICAL
//       restored deadline stamps for the same payload - restoreClock
//       never reads the authority, accrual does.
//   (C) envelope <-> arms: DATA_REFUSE_CODES members map to 'recovery';
//       driveSave's refuse envelope is byte-identical under local and
//       remote-authoritative adapters; observeSaveResult transitions
//       only when a reconnect dep exists.
//   (D) divergent-clock + replace/merge: a remote save from a fast-clock
//       device re-grounds under live-replacement and survives the next
//       write; the decompose merge-vs-production-replace asymmetry is
//       exercised and documented.
//   (E) documented INT observations (Nit/Low evidence): cap-order
//       asymmetry between array and map collection validators, the
//       decompose-vs-tribulation admission-pin asymmetry, and the
//       restoreJobs clone arm that still throws on an ungated shape the
//       validator now names cleanly.
// ============================================================================

const FOREST_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.forest
const MORTAL_CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['mortal'] ?? 100, 1) * 1000
const DECOMPOSE_CYCLE_MS = 30_000

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

function restoreIntoReader(
  wire: GameSave,
  authority?: RestoreTimeAuthority,
): { reader: GameManager; readerPlayer: PlayerData } {
  const reader = registeredManager()
  const readerPlayer = createDefaultPlayer()
  reader.setActivePlayer(readerPlayer)
  reader.saveOps.restoreFromSave(wire, authority)
  return { reader, readerPlayer }
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

function pillRoomEntry() {
  return {
    instanceId: 'inst_pill_room_1',
    buildingId: 'pill_room',
    level: 1,
    lastCollectedAt: Math.floor(currentMs / 1000),
  }
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

describe('auditR27 INT probe - round-trip agreement (R)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('R1 +Delta marker payload is ADMITTED, every deadline channel re-grounds at device-now, and the rebuilt save re-passes admission (self-brick closed)', () => {
    const DELTA = 30_000
    const { job, recipe, span } = mortalJob(currentMs + 20_000, 'r27i_r1')

    const wire = validWireSave()
    wire.player.lastSavedAt = currentMs + DELTA
    wire.buildings = [...wire.buildings, pillRoomEntry() as never]
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
    wire.decompose = {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: currentMs + DELTA + 25_000,
      started: true,
    }

    // The read gate admits the whole +Delta shape: marker and every
    // began-time sit inside the payload's own epoch.
    const admitted = validateGameSaveShape(JSON.parse(JSON.stringify(wire)) as GameSave)
    expect(admitted.ok).toBe(true)

    const { reader, readerPlayer } = restoreIntoReader(wire, undefined)

    // restoreClock = min(marker, now) = now - all four channels ground at it.
    const lane = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(lane.startedAtMs).toBe(currentMs)
    expect(lane.completesAtMs).toBe(currentMs + MORTAL_CYCLE_MS)

    const restoredJob = reader.alchemySystem.getJobs()[0]!
    expect(restoredJob.startedAtMs).toBe(currentMs)
    expect(restoredJob.completesAtMs).toBe(currentMs + span)
    expect(verifyAlchemyJobReservation(restoredJob, recipe)).toBeNull()
    expect(alchemyJobReservationDigest(restoredJob, restoredJob.reservation!)).toBe(
      restoredJob.reservation!.digest,
    )

    expect(reader.tribulationDirector.serializeRuntime().cooldownUntil).toBe(
      currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000,
    )
    expect(reader.decomposeSystem.getSaveState().nextCycleAt).toBe(
      currentMs + DECOMPOSE_CYCLE_MS,
    )

    // Round-trip: the next write is judged by the SAME gate and now passes
    // - every persisted stamp sits at or below the new marker.
    const rebuilt = JSON.parse(
      JSON.stringify(buildGameSave(readerPlayer, reader)),
    ) as GameSave
    const revalidated = validateGameSaveShape(rebuilt)
    expect(
      revalidated.issues.filter((issue) => issue.message.includes('lastSavedAt')),
    ).toHaveLength(0)
    expect(revalidated.ok).toBe(true)
  })

  it('R2 driveSave refuses a post-dated began-stamp with the identical armed envelope under BOTH adapters - write gate and read gate run one validator', async () => {
    for (const capability of ['local', 'remote-authoritative'] as const) {
      const { service, saveCalls } = mockService(capability)
      const coordinator = new CloudSaveCoordinator(service)

      const snapshot = validWireSave()
      grantWorkerCapacity(snapshot)
      // The classic self-brick shape: a lane head past the payload's own
      // marker can never have been written by a legal writer.
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

      // Same verdict at the read gate (deterministic agreement).
      const shape = validateGameSaveShape(JSON.parse(JSON.stringify(snapshot)) as GameSave)
      expect(shape.ok).toBe(false)
      expect(
        shape.issues.some((issue) => issue.message.includes('vượt lastSavedAt')),
      ).toBe(true)

      const result = await coordinator.save(snapshot)
      expect(result.status).toBe('unavailable')
      if (result.status === 'unavailable') {
        expect(result.retryable).toBe(false)
        expect(result.code).toBe('SAVE_INVALID')
        expect(result.detail).toBe('OUTGOING_ADMISSION_REJECTED')
      }
      // The refuse never reaches the adapter - healthy slot preserved.
      expect(saveCalls).toHaveLength(0)
    }
  })

  it('R3 non-finite marker degrades restoreClock to device-now (defensive arm, ungated callers)', () => {
    const wire = validWireSave()
    ;(wire.player as unknown as Record<string, unknown>).lastSavedAt = Number.NaN
    wire.productionSites = [
      {
        siteId: FOREST_SITE_ID,
        level: 1,
        autoRestart: false,
        activeWorkerSlots: 1,
        workerCycles: [workerCycle(currentMs + 60_000, 'post-dated')],
      },
    ] as never

    const { reader } = restoreIntoReader(wire, undefined)
    const lane = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(lane.startedAtMs).toBe(currentMs)
  })
})

describe('auditR27 INT probe - authority-source matrix (A)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('A1 four authority sources restore IDENTICAL deadline stamps for the same payload - restoreClock never reads the authority', () => {
    // marker only 30s back: elapsed stays under the 60s settle gate so no
    // settle can touch the channels - the assertion isolates RESTORE-level
    // deadline identity from accrual (which COR probes already cover).
    const marker = currentMs - 30_000
    const { job, span } = mortalJob(marker - 1_000, 'r27i_a1')

    const makeWire = (): GameSave => {
      const wire = validWireSave()
      wire.player.lastSavedAt = marker
      wire.buildings = [...wire.buildings, pillRoomEntry() as never]
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
      wire.tribulation = { cooldownUntil: marker + TRIBULATION_COOLDOWN_SECONDS * 1000 }
      wire.decompose = {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
        nextCycleAt: marker + DECOMPOSE_CYCLE_MS,
        started: true,
      }
      return wire
    }

    const sources: Array<{ label: string; authority: RestoreTimeAuthority | undefined }> = [
      { label: 'absent (legacy local)', authority: undefined },
      {
        label: 'honest cold-boot',
        // elapsed = 130s > 60: the production settle RUNS under this
        // authority - every channel stays in-flight (all deadlines still
        // ahead of settleNow), so restore stamps remain verbatim.
        authority: { kind: 'cold-boot', sinceMs: marker - 100_000, untilMs: currentMs },
      },
      {
        label: 'live-replacement',
        authority: { kind: 'live-replacement', nowMs: currentMs },
      },
      {
        label: 'corrupt-LOW cold-boot (seconds-for-millis)',
        authority: { kind: 'cold-boot', sinceMs: 1_700_000_000 - 61_000, untilMs: 1_700_000_000 },
      },
    ]

    const observed = sources.map(({ label, authority }) => {
      const { reader } = restoreIntoReader(makeWire(), authority)
      const lane = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
      const restoredJob = reader.alchemySystem.getJobs()[0]!
      return {
        label,
        cycle: [lane.startedAtMs, lane.completesAtMs],
        job: [restoredJob.startedAtMs, restoredJob.completesAtMs],
        cooldown: reader.tribulationDirector.serializeRuntime().cooldownUntil,
        nextCycleAt: reader.decomposeSystem.getSaveState().nextCycleAt,
      }
    })

    const baseline = observed[0]!
    for (const entry of observed) {
      expect(entry.cycle, `${entry.label}: workerCycle stamps`).toEqual(baseline.cycle)
      expect(entry.job, `${entry.label}: alchemyJob stamps`).toEqual(baseline.job)
      expect(entry.cooldown, `${entry.label}: cooldownUntil`).toBe(baseline.cooldown)
      expect(entry.nextCycleAt, `${entry.label}: nextCycleAt`).toBe(baseline.nextCycleAt)
    }
    // And the baseline is the VERBATIM payload stamps - honest content is
    // never re-anchored by any authority class.
    expect(baseline.cycle).toEqual([marker - 1_000, marker - 1_000 + MORTAL_CYCLE_MS])
    expect(baseline.job).toEqual([marker - 1_000, marker - 1_000 + span])
    expect(baseline.cooldown).toBe(marker + TRIBULATION_COOLDOWN_SECONDS * 1000)
    expect(baseline.nextCycleAt).toBe(marker + DECOMPOSE_CYCLE_MS)
  })

  it('A2 malformed authority forms degrade to the deny primitive WITHOUT touching the restore clock', () => {
    const marker = currentMs - 100_000
    const makeWire = (): GameSave => {
      const wire = validWireSave()
      wire.player.lastSavedAt = marker
      wire.productionSites = [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: false,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(marker - 1_000, 'honest')],
        },
      ] as never
      return wire
    }

    const corruptForms: Array<RestoreTimeAuthority | null> = [
      null as never,
      { kind: 'live-replacement', nowMs: Number.NaN } as never,
      { kind: 'live-replacement', nowMs: 2 ** 53 } as never,
      { kind: 'bogus', nowMs: currentMs } as never,
      { kind: 'cold-boot', sinceMs: marker, untilMs: 2 ** 53 } as never,
    ]

    for (const authority of corruptForms) {
      const { reader } = restoreIntoReader(makeWire(), authority as never)
      const lane = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
      // Deadline channel is authority-independent: verbatim restore.
      expect(lane.startedAtMs).toBe(marker - 1_000)
      expect(lane.completesAtMs).toBe(marker - 1_000 + MORTAL_CYCLE_MS)
    }
  })
})

describe('auditR27 INT probe - envelope codes vs authority arms (C)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function controller(remote: boolean): OnlineSessionController {
    return new OnlineSessionController({
      monotonicNow: () => 0,
      scheduleInterval: () => 0,
      clearHandle: () => undefined,
      // A reconnect dep that never settles keeps 'reconnecting' stable.
      reconnect: remote ? () => new Promise(() => {}) : undefined,
    })
  }

  it('C1 DATA_REFUSE_CODES members all map to recovery; boundary codes keep their own terminals; the arming predicate is exactly {unavailable, !retryable, coded, member}', () => {
    expect([...DATA_REFUSE_CODES].sort()).toEqual(['SAVE_INVALID', 'SAVE_TOO_LARGE'])

    for (const code of DATA_REFUSE_CODES) {
      expect(authorityStateForError(code)).toBe('recovery')
    }
    // Boundary siblings: recovery-mapped but NOT armed (the SERVER_ERROR
    // bucket stays out of the data-refuse set by design - W8-AUT-1).
    expect(authorityStateForError('CONFIGURATION_ERROR')).toBe('recovery')
    expect(DATA_REFUSE_CODES.has('CONFIGURATION_ERROR')).toBe(false)
    expect(DATA_REFUSE_CODES.has('SERVER_ERROR')).toBe(false)

    expect(authorityStateForError('SAVE_CONFLICT')).toBe('conflict')
    expect(authorityStateForError('SESSION_REVOKED')).toBe('revoked')
    expect(authorityStateForError('PROTOCOL_OUTDATED')).toBe('update-required')
    expect(authorityStateForError('MAINTENANCE')).toBe('maintenance')
    expect(authorityStateForError('AUTH_EXPIRED')).toBe('reconnecting')
    expect(authorityStateForError('SERVER_ERROR')).toBe('reconnecting')
    expect(authorityStateForError('NETWORK_UNAVAILABLE')).toBe('reconnecting')
    expect(authorityStateForError(undefined)).toBe('reconnecting')
  })

  it('C2 driveSave envelope is byte-identical under local and remote-authoritative adapters', async () => {
    const envelopes: unknown[] = []
    for (const capability of ['local', 'remote-authoritative'] as const) {
      const { service } = mockService(capability)
      const coordinator = new CloudSaveCoordinator(service)
      const snapshot = validWireSave()
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
      envelopes.push(await coordinator.save(snapshot))
    }
    expect(envelopes[0]).toEqual(envelopes[1])
    expect(envelopes[0]).toMatchObject({
      status: 'unavailable',
      retryable: false,
      code: 'SAVE_INVALID',
      detail: 'OUTGOING_ADMISSION_REJECTED',
    })
  })

  it('C3 observeSaveResult only transitions when a reconnect dep exists; AUTH_EXPIRED non-retryable always revokes', () => {
    const local = controller(false)
    local.beginChecking()
    local.markReady()
    expect(local.authorityState).toBe('ready')
    local.observeSaveResult({
      status: 'unavailable',
      code: 'SAVE_INVALID',
      retryable: false,
      message: 'x',
    } as never)
    // Local mode: no authority to lose - the caller's own surface owns it.
    expect(local.authorityState).toBe('ready')

    const remote = controller(true)
    remote.beginChecking()
    remote.markReady()
    remote.observeSaveResult({
      status: 'unavailable',
      code: 'SAVE_INVALID',
      retryable: false,
      message: 'x',
    } as never)
    expect(remote.authorityState).toBe('recovery')

    const authExpired = controller(true)
    authExpired.beginChecking()
    authExpired.markReady()
    authExpired.observeSaveResult({
      status: 'unavailable',
      code: 'AUTH_EXPIRED',
      retryable: false,
      message: 'x',
    } as never)
    expect(authExpired.authorityState).toBe('revoked')

    const transient = controller(true)
    transient.beginChecking()
    transient.markReady()
    transient.observeSaveResult({
      status: 'unavailable',
      code: 'SERVER_ERROR',
      retryable: true,
      message: 'x',
    } as never)
    expect(transient.authorityState).toBe('reconnecting')
  })

  it('C4 OUTGOING_UNSERIALIZABLE envelope matches the armed shape (non-JSON-serializable snapshot)', async () => {
    const { service, saveCalls } = mockService('remote-authoritative')
    const coordinator = new CloudSaveCoordinator(service)
    const snapshot = validWireSave()
    ;(snapshot as unknown as Record<string, unknown>).materials = [{ amount: 10n }]

    const result = await coordinator.save(snapshot)
    expect(result).toMatchObject({
      status: 'unavailable',
      retryable: false,
      code: 'SAVE_INVALID',
      detail: 'OUTGOING_UNSERIALIZABLE',
    })
    expect(saveCalls).toHaveLength(0)
  })
})

describe('auditR27 INT probe - divergent clocks + replace/merge (D)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('D1 live-replacement of a fast-clock remote save re-grounds post-dated lanes at THIS device clock - next write survives admission', () => {
    const REMOTE_SKEW = 120_000 // other device ran +2min
    const wire = validWireSave()
    wire.player.lastSavedAt = currentMs + REMOTE_SKEW
    grantWorkerCapacity(wire)
    wire.productionSites = [
      {
        siteId: FOREST_SITE_ID,
        level: 1,
        autoRestart: false,
        activeWorkerSlots: 1,
        // Legal on the writer's clock (<= its marker), post-dated on ours.
        workerCycles: [workerCycle(currentMs + 115_000, 'cross-device')],
      },
    ] as never

    const admitted = validateGameSaveShape(JSON.parse(JSON.stringify(wire)) as GameSave)
    expect(admitted.ok).toBe(true)

    const { reader, readerPlayer } = restoreIntoReader(wire, {
      kind: 'live-replacement',
      nowMs: currentMs,
    })
    const lane = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(lane.startedAtMs).toBe(currentMs)
    expect(lane.completesAtMs).toBe(currentMs + MORTAL_CYCLE_MS)

    const rebuilt = JSON.parse(
      JSON.stringify(buildGameSave(readerPlayer, reader)),
    ) as GameSave
    expect(validateGameSaveShape(rebuilt).ok).toBe(true)
  })

  it('D2 decompose merge keeps the live (later) timer on a DIFFERENT payload while production lanes replace - documented asymmetry', () => {
    const reader = registeredManager()
    const readerPlayer = createDefaultPlayer()
    reader.setActivePlayer(readerPlayer)

    const wire1 = validWireSave()
    wire1.player.lastSavedAt = currentMs - 10_000
    grantWorkerCapacity(wire1)
    wire1.productionSites = [
      {
        siteId: FOREST_SITE_ID,
        level: 1,
        autoRestart: false,
        activeWorkerSlots: 1,
        workerCycles: [workerCycle(currentMs - 5_000, 'lane-one')],
      },
    ] as never
    wire1.decompose = {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: currentMs + 20_000,
      started: true,
    }
    reader.saveOps.restoreFromSave(wire1, undefined)

    // Second payload: different content (quests slice present vs absent)
    // forces a full re-restore; its decompose deadline is EARLIER.
    const wire2 = validWireSave()
    wire2.player.lastSavedAt = currentMs - 5_000
    wire2.quests = { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 } as never
    grantWorkerCapacity(wire2)
    wire2.productionSites = [
      {
        siteId: FOREST_SITE_ID,
        level: 1,
        autoRestart: false,
        activeWorkerSlots: 1,
        workerCycles: [workerCycle(currentMs - 2_000, 'lane-two')],
      },
    ] as never
    wire2.decompose = {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: currentMs + 5_000,
      started: true,
    }
    reader.saveOps.restoreFromSave(wire2, undefined)

    // Production: replacement - the second payload's lane is the only one.
    const lanes = reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles!
    expect(lanes).toHaveLength(1)
    expect(lanes[0]!.cycleId).toBe('lane-two')

    // Decompose: merge - the live (later) timer wins over the older payload.
    expect(reader.decomposeSystem.getSaveState().nextCycleAt).toBe(currentMs + 20_000)
  })

  it('D3 payload-identity dedupe excludes only lastSavedAt - a marker-only delta converges, a content delta re-restores', () => {
    const reader = registeredManager()
    const readerPlayer = createDefaultPlayer()
    reader.setActivePlayer(readerPlayer)

    // Content identical across markers (identity excludes lastSavedAt).
    // Both markers sit under the 60s settle gate so the lane survives
    // verbatim - the probe isolates dedupe, not settle interplay.
    const makeWire = (marker: number): GameSave => {
      const wire = validWireSave()
      wire.player.lastSavedAt = marker
      grantWorkerCapacity(wire)
      wire.productionSites = [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: false,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(currentMs - 61_000, 'lane-same')],
        },
      ] as never
      return wire
    }

    reader.saveOps.restoreFromSave(makeWire(currentMs - 30_000), undefined)
    expect(
      reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!.cycleId,
    ).toBe('lane-same')

    // Tamper with live lanes: a deduped second restore leaves them alone.
    reader.productionSystem.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: false,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(currentMs - 2_000, 'tampered')],
        },
      ],
      currentMs,
    )
    const spy = vi.spyOn(reader.productionSystem, 'restoreStates')

    // Same content, newer marker: identity converges - no re-restore.
    reader.saveOps.restoreFromSave(makeWire(currentMs - 10_000), undefined)
    expect(spy).not.toHaveBeenCalled()
    expect(
      reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!.cycleId,
    ).toBe('tampered')

    // Content delta (different lane ids -> different identity): full restore.
    const wire3 = validWireSave()
    wire3.player.lastSavedAt = currentMs - 5_000
    grantWorkerCapacity(wire3)
    wire3.productionSites = [
      {
        siteId: FOREST_SITE_ID,
        level: 1,
        autoRestart: false,
        activeWorkerSlots: 1,
        workerCycles: [workerCycle(currentMs - 4_000, 'lane-three')],
      },
    ] as never
    reader.saveOps.restoreFromSave(wire3, undefined)
    expect(
      reader.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!.cycleId,
    ).toBe('lane-three')
  })
})

describe('auditR27 INT probe - documented asymmetries (E)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('E1 cap-order asymmetry: over-cap ARRAY still walks entries (cap issue + per-entry issues); over-cap MAP stops at the cap issue', () => {
    // productionSites is an optionalArray: >1024 pushes the cap issue AND
    // still walks every malformed entry.
    const wireArray = validWireSave()
    wireArray.productionSites = Array.from({ length: 1025 }, (_v, i) => ({
      siteId: i === 0 ? FOREST_SITE_ID : `bogus_site_${i}`,
      level: 0,
      autoRestart: false,
      activeWorkerSlots: 0,
    })) as never
    const shapeArray = validateGameSaveShape(JSON.parse(JSON.stringify(wireArray)) as GameSave)
    expect(
      shapeArray.issues.some(
        (issue) => issue.path === '.productionSites' && issue.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(true)
    expect(
      shapeArray.issues.some((issue) => issue.path.startsWith('productionSites[')),
    ).toBe(true)

    // hiddenBeastKills is a nonNegativeIntMap: >1024 pushes the cap issue
    // and returns before the entry walk - no per-entry issues even though
    // every value below is malformed for the map contract.
    const wireMap = validWireSave()
    const bigMap: Record<string, number> = {}
    for (let i = 0; i < 1025; i += 1) bigMap[`k_${i}`] = -1
    ;(wireMap.player as unknown as Record<string, unknown>).hiddenBeastKills = bigMap
    const shapeMap = validateGameSaveShape(JSON.parse(JSON.stringify(wireMap)) as GameSave)
    expect(
      shapeMap.issues.some(
        (issue) =>
          issue.path === 'player.hiddenBeastKills' &&
          issue.message.includes('ID_COLLECTION_CAP'),
      ),
    ).toBe(true)
    expect(
      shapeMap.issues.some((issue) => issue.path.startsWith('player.hiddenBeastKills.')),
    ).toBe(false)
  })

  it('E2 admission asymmetry: far-future decompose.nextCycleAt is ADMITTED (restore clamp owns it); far-future tribulation.cooldownUntil is REFUSED at the gate', () => {
    const wireDecompose = validWireSave()
    wireDecompose.decompose = {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: currentMs + 9_000_000_000,
      started: true,
    }
    const shapeDecompose = validateGameSaveShape(
      JSON.parse(JSON.stringify(wireDecompose)) as GameSave,
    )
    expect(shapeDecompose.ok).toBe(true)

    const wireTrib = validWireSave()
    wireTrib.tribulation = { cooldownUntil: currentMs + 9_000_000_000 }
    const shapeTrib = validateGameSaveShape(JSON.parse(JSON.stringify(wireTrib)) as GameSave)
    expect(shapeTrib.ok).toBe(false)
    expect(
      shapeTrib.issues.some((issue) => issue.path === '.tribulation.cooldownUntil'),
    ).toBe(true)
  })

  it('E3 verify names a malformed witness cleanly while the restoreJobs CLONE still throws on the same bypassed shape (ungated-path divergence)', () => {
    const { job, recipe } = mortalJob(currentMs - 60_000, 'r27i_e3')
    const crafted = {
      ...job,
      reservation: { costScale: 1, digest: 0, specialIngredients: {} },
    }

    // Gate layer: clean field-name verdict (r27-COR-2).
    expect(verifyAlchemyJobReservation(crafted, recipe)).toBe('specialIngredients')

    // Restore layer on an ungated caller: the deep-copy still dereferences
    // .map over the truthy non-array and throws TypeError (handled upstream
    // as a 'rejected' restore - deny direction, never silent).
    const system = new GameManager().alchemySystem
    expect(() => system.restoreJobs([crafted as never], currentMs)).toThrow(TypeError)
  })

  it('E4 seeded pending heads re-stamp forward by exactly Date.now()-settleNow; resulting wire stays inside the marker pin', () => {
    const settleNow = currentMs - 1_000
    const offlineSince = currentMs - 2_000

    const system = createProductionSystem()
    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 0,
          workerCycles: [],
        },
      ],
      currentMs,
    )

    system.settleOffline(
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      settleNow,
      {
        workerCapacity: 3,
        offlineSinceMs: offlineSince,
        rng: () => 0,
      },
    )

    const pending = system.getState(FOREST_SITE_ID)!.workerCycles!
    expect(pending.length).toBeGreaterThan(0)
    for (const head of pending) {
      // Seeded at offlineSince, re-stamped forward by Date.now()-settleNow
      // (=1000): the lane resumes in the FIELD epoch just like r16-18.
      expect(head.startedAtMs).toBe(offlineSince + 1_000)
      expect(head.completesAtMs).toBe(offlineSince + MORTAL_CYCLE_MS + 1_000)
    }

    // The resulting wire re-passes admission under a fresh marker.
    const wire = validWireSave()
    wire.productionSites = JSON.parse(JSON.stringify(system.getAllStates())) as never
    wire.player.lastSavedAt = currentMs
    const shape = validateGameSaveShape(wire)
    expect(
      shape.issues.filter((issue) => issue.message.includes('vượt lastSavedAt')),
    ).toHaveLength(0)
  })
})
