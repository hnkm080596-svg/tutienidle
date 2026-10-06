// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { usePlayerStore } from '../../stores/player'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave, restoreGameSession, type GameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from './saveAcceptance'
import { sanitizeRestoreAuthority } from './saveTypes'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { alchemySecondsFor } from '../../core/alchemy/AlchemySystem'
import { TRIBULATION_COOLDOWN_SECONDS } from '../../core/tribulation/TribulationDirector'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import { REWARD_TABLE_VERSION } from '../../core/production/ProductionCycles'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { CloudSaveCoordinator } from '../cloudSave/CloudSaveCoordinator'
import type {
  CloudSaveLoadResult,
  CloudSaveService,
  CloudSaveWriteResult,
} from '../cloudSave/CloudSaveService'
import { useAppLifecycle } from '../../composables/useAppLifecycle'

// ============================================================================
// QA probe - fixpoint r26 AUT wave (blind audit of commit 8f3cb237, the r25
// adjudication batch: driveSave write-side shape gate on the WIRE form,
// sanitizeRestoreAuthority kind whitelist, Date.now() clamps on
// offlineSinceMs / effectProvenanceMs / appliedAtMs, ID_COLLECTION_CAP=1024
// on requireArray/optionalArray + the three record maps, QUEST cap ordering,
// useAppLifecycle remote+absent-serverAuthority fail-closed degrade).
//
// Attack arms under test:
//   A. Self-brick residual: the admission pins compare stamps to the
//      payload's OWN lastSavedAt. A shape-valid payload stamped under a
//      skewed (or crafted) clock carries post-dated deadline records;
//      restore loads workerCycles / alchemyJobs / tribulation.cooldownUntil
//      VERBATIM and the next write stamps a real now under them -> the
//      write gate refuses every save until the wall clock catches up
//      (up to |x|<2^52 ms). The r25 "bounded deny" claim is audited here.
//   B. Remote boot wedge: OUTGOING_ADMISSION_REJECTED is retryable:true
//      and carries no `code`, so it cannot satisfy the DATA_REFUSE_CODES
//      arm at useAppLifecycle.ts:567-571 - it lands in the generic
//      onError + boot.fail() arm on EVERY remote-authoritative boot.
//   C. Cap coverage: validateNonNegativeIntMap (hiddenBeastKills /
//      productionSites[].hiddenChannelCycles) and the never-validated
//      player.hiddenPerfection arrays evade ID_COLLECTION_CAP.
//   D. Wire-form (8f3cb237): unserializable payload -> OUTGOING_
//      UNSERIALIZABLE retryable:false, service.save never runs; NaN ->
//      null in wire -> shape-invalid (admission), not silent.
//   E. Closed siblings (rejected arms): kind whitelist, autofarm
//      re-anchor, daily-reset clamp, decompose nextCycleAt idle-wedge.
// ============================================================================

const NOW = 1_725_160_000_000
const DAY_MS = 86_400_000
// Crafted marker: ~400 days ahead of the client clock - large enough that
// "progress defers until the stamps are in-domain" is a permanent wedge.
const FUTURE = NOW + 400 * DAY_MS

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

function makeSave(
  overrides: {
    lastSavedAt?: number
    productionSites?: GameSave['productionSites']
    quests?: GameSave['quests']
    autoWorkerCapacity?: number
  } = {},
): GameSave {
  const manager = registeredManager()
  const player = createDefaultPlayer()
  primeMortalCreationPick(player, manager.skillManager)
  player.cultivation = 0
  player.cultivationPerSecond = 1
  if (overrides.autoWorkerCapacity !== undefined) {
    player.autoWorkerCapacity = overrides.autoWorkerCapacity
  }
  const save = buildGameSave(player, manager)
  save.player.lastSavedAt = overrides.lastSavedAt ?? NOW
  if (overrides.productionSites !== undefined) {
    save.productionSites = overrides.productionSites
  }
  if (overrides.quests !== undefined) {
    save.quests = overrides.quests
  }
  if (overrides.autoWorkerCapacity !== undefined && overrides.autoWorkerCapacity > 0) {
    // F-W-16: a non-zero persisted capacity requires the chi_hien_quan
    // building witness in the same payload.
    save.buildings = [
      { instanceId: 'r26_chq', buildingId: 'chi_hien_quan', level: 1, lastCollectedAt: 0 },
    ]
  }
  return save
}

function workerCycleSave(startedAtMs: number) {
  const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM['mortal']
  if (baseSeconds === undefined) throw new Error('mortal cycle base missing')
  const spanMs = computeCycleSeconds(baseSeconds, 1) * 1000
  return {
    cycleId: 'r26-forged-head',
    siteId: 'thanh_van_lam',
    collectionRealmId: 'mortal',
    siteLevelAtStart: 1,
    rewardTableVersion: REWARD_TABLE_VERSION,
    rollSeed: 42,
    startedAtMs,
    completesAtMs: startedAtMs + spanMs,
  }
}

const JOB_RECIPE = alchemyRecipes.find((r) => r.id === 'alchemy_thong_mach_dan')!

function jobAt(startedAtMs: number) {
  return alchemyJobFixture(
    {
      jobId: 'r26-forged-job',
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

/** A shape-valid payload stamped under a clock ~400 days ahead: every
 *  deadline channel is legal RELATIVE TO THE PAYLOAD'S OWN MARKER, and
 *  post-dated in real time. This is the honest skewed-clock row the
 *  write-gate comment cites ("synced from another machine") - and the
 *  crafted-import row the acceptance gate cannot clock-check. */
function forgedFutureSave(): GameSave {
  const save = makeSave({
    lastSavedAt: FUTURE,
    autoWorkerCapacity: 3, // authored lane ceiling so a cycle admits
    productionSites: [
      {
        siteId: 'thanh_van_lam',
        level: 1,
        autoRestart: true,
        workerCycles: [workerCycleSave(FUTURE - 60_000)],
      },
    ],
  })
  // chi_hien_quan is already the autoWorkerCapacity witness; pill_room
  // level 1 covers the job's roomLevelAtStart coherence bound (mortal
  // realm tier caps building level at 1).
  save.buildings!.push(
    { instanceId: 'r26-pill', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 },
  )
  save.alchemyJobs = [jobAt(FUTURE - 120_000)]
  save.tribulation = { cooldownUntil: FUTURE + TRIBULATION_COOLDOWN_SECONDS * 1000 }
  save.decompose = {
    settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
    nextCycleAt: FUTURE + DAY_MS,
    started: true,
  }
  return save
}

function gateRefuseService(): {
  service: CloudSaveService
  sawSave: () => boolean
} {
  let saw = false
  const service: CloudSaveService = {
    capability: 'local-only',
    async load() {
      return { status: 'empty', revision: 0 }
    },
    async save(_save, expectedRevision) {
      saw = true
      return { status: 'ok', revision: expectedRevision + 1 }
    },
  }
  return { service, sawSave: () => saw }
}

// ---------------------------------------------------------------------------
describe('arm A - post-dated deadline stamps restore verbatim; the write gate bricks write N+1', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('A1 precondition: the crafted payload passes BOTH admission surfaces (shape + isSaveAcceptable)', () => {
    const save = forgedFutureSave()
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(true)
    // The stricter foreign-payload gate has no clock checks - the import /
    // remote newest-wins seams cannot rescue the row either.
    expect(isSaveAcceptable(save, staticSaveAcceptanceCatalogs())).toBe(true)
  })

  it('A2 restore re-anchors post-dated stamps to the restore clock (workerCycles / alchemyJobs / cooldownUntil / nextCycleAt)', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    const result = restoreGameSession(player, manager, forgedFutureSave(), undefined)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)

    // FIX (r26 adjudication): a began-time/deadline past the restore
    // clock is impossible-authored, so each seam re-grounds it - the
    // began-time pairs shift together (authored span preserved), the
    // deadline fields clamp at their authored max-remaining.
    const job = manager.alchemySystem.getJobs()[0]!
    const jobSpan = alchemySecondsFor(JOB_RECIPE, 1) * 1000
    expect(job.startedAtMs).toBe(NOW)
    expect(job.completesAtMs).toBe(NOW + jobSpan)
    expect(manager.tribulationDirector.serializeRuntime().cooldownUntil).toBe(
      NOW + TRIBULATION_COOLDOWN_SECONDS * 1000,
    )
    const heads = manager.productionSystem.getAllStates().flatMap((s) => s.workerCycles ?? [])
    const head = heads.find((c) => c.cycleId === 'r26-forged-head')!
    const cycleSpan = head.completesAtMs - head.startedAtMs
    expect(head.startedAtMs).toBe(NOW)
    expect(cycleSpan).toBe(computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['mortal']!, 1) * 1000)
    // nextCycleAt re-bases at restore-now + cycleMs like the tick does.
    expect(manager.decomposeSystem.getSaveState().nextCycleAt).toBeLessThanOrEqual(NOW + 60_000)
  })

  it('A3 write N+1 self-bricks on the real repackaged payload, and the gate refuses before the service', async () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    const result = restoreGameSession(player, manager, forgedFutureSave(), undefined)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)

    // What every subsequent write ships: a real-now marker - and the
    // re-anchored stamps now sit INSIDE the admitted domain, so the
    // repackaged payload validates (the wedge is gone at the source).
    const repackaged = buildGameSave(player.$state, manager)
    expect(repackaged.player.lastSavedAt).toBe(NOW)

    const shape = validateGameSaveShape(repackaged)
    expect(shape.ok).toBe(true)

    // Pin the NEW refuse envelope contract on a hand-mutated
    // self-failing payload (the class A3 probed): a post-dated deadline
    // injected back into the write object must refuse BEFORE the
    // service with the data-class code the DATA_REFUSE arm matches.
    repackaged.tribulation = {
      ...(repackaged.tribulation ?? {}),
      cooldownUntil: NOW + TRIBULATION_COOLDOWN_SECONDS * 1000 + 60_000,
    }
    const { service, sawSave } = gateRefuseService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()
    const refused = await coordinator.save(repackaged)
    expect(refused.status).toBe('unavailable')
    if (refused.status === 'unavailable') {
      expect(refused.detail).toBe('OUTGOING_ADMISSION_REJECTED')
      // FIX: retryable:false + code SAVE_INVALID - the refuse is
      // deterministic for the same in-memory state, and the data-class
      // code is exactly what DATA_REFUSE_CODES matches so the
      // corrupted-save surface arms instead of looping generic fails.
      expect(refused.retryable).toBe(false)
      expect(refused.code).toBe('SAVE_INVALID')
    }
    expect(sawSave()).toBe(false)
  })

  it('A4 the wedge is gone at any marker: re-anchored stamps keep writes admissible', async () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    const result = restoreGameSession(player, manager, forgedFutureSave(), undefined)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    const repackaged = buildGameSave(player.$state, manager)

    const { service, sawSave } = gateRefuseService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    // FIX: the restore-side re-anchor means the repackaged payload
    // carries no post-dated content at all - even a marker far past
    // real-now sees stamps that sit inside their authored bounds, so
    // every write commits (wedge duration: zero, not the forged delta).
    const before = await coordinator.save({
      ...repackaged,
      player: { ...repackaged.player, lastSavedAt: FUTURE - 1_000 },
    })
    expect(before.status).toBe('ok')
    expect(sawSave()).toBe(true)

    const atMarker = await coordinator.save({
      ...repackaged,
      player: { ...repackaged.player, lastSavedAt: FUTURE },
    })
    expect(atMarker.status).toBe('ok')
  })
})

// ---------------------------------------------------------------------------
describe('arm B - remote-authoritative boot wedges at the post-accrual commit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('B1 a refused boot commit now arms the remote-reset surface: saveIssue.report + boot.fail(), no generic onError', async () => {
    // Build the repackaged snapshot through the REAL restore+build
    // pipeline, then inject the impossible deadline back in - the
    // restore re-anchor means honest state can no longer produce a
    // self-failing write, so the probe crafts one explicitly (the same
    // class the arm exists for: imported/adopted rows, not live writes).
    const playerStore = usePlayerStore()
    const manager = registeredManager()
    const restored = restoreGameSession(playerStore, manager, forgedFutureSave(), undefined)
    expect(restored.status).toBe('ok')
    const repackaged = buildGameSave(playerStore.$state, manager)
    repackaged.tribulation = {
      ...(repackaged.tribulation ?? {}),
      cooldownUntil: NOW + TRIBULATION_COOLDOWN_SECONDS * 1000 + 60_000,
    }

    // The REAL coordinator produces the refuse object the lifecycle sees.
    const { service } = gateRefuseService()
    const realCoordinator = new CloudSaveCoordinator(service)
    await realCoordinator.load()

    const fail = vi.fn()
    const enterGame = vi.fn()
    const onError = vi.fn()
    const saveIssueReport = vi.fn()
    const intervals: Array<() => void> = []

    const coordinatorStub = {
      capability: 'remote-authoritative' as const,
      async load(): Promise<CloudSaveLoadResult> {
        return {
          status: 'ok',
          save: forgedFutureSave(),
          revision: 3,
          discardedEquipmentCount: 0,
          raw: '{}',
          serverAuthority: { serverNowMs: NOW },
        }
      },
      async save(): Promise<CloudSaveWriteResult> {
        return { status: 'ok', revision: 4 }
      },
      reset: vi.fn(),
    }
    const playerStub = {
      save: async () => realCoordinator.save(repackaged),
      restoreFromSave: vi.fn(),
      $state: {},
    }
    const gameManagerStub = {
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
    }

    const lifecycle = useAppLifecycle({
      clock: { start: vi.fn(), stop: vi.fn(), nowSeconds: () => 0 },
      scheduleInterval: (cb) => (intervals.push(cb), intervals.length),
      clearHandle: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      boot: {
        startSaveLoad: vi.fn(),
        startInitializing: vi.fn(),
        enterGame,
        fail,
        requireCharacter: vi.fn(),
        showAuth: vi.fn(),
      },
      coordinator: coordinatorStub,
      authority: {
        canMutate: () => true,
        beginChecking: vi.fn(),
        markReady: vi.fn(),
        markFailed: vi.fn(),
        observeSaveResult: vi.fn(),
      },
      player: playerStub,
      gameManager: gameManagerStub as never,
      tick: vi.fn(),
      offlineSummary: { show: vi.fn() },
      saveIssue: { report: saveIssueReport },
      entryStage: ref('game'),
      restoreGameSession: () => ({
        status: 'ok' as const,
        offline: { elapsedSeconds: 0, cultivation: 0 },
      }),
      persistPlayer: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      onError,
      unsupportedSaveNotice: vi.fn(),
      hardReset: vi.fn(),
    })

    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    // FIX: the refuse envelope now carries code SAVE_INVALID +
    // retryable:false, so the DATA_REFUSE_CODES arm - the designed
    // un-wedge (remote reset + payload export) - fires at first commit.
    // The corrupted-save card mounts remote-scoped (remote reset IS the
    // honest heal here), boot fails, and the generic onError arm is
    // skipped by the arm's early return.
    expect(fail).toHaveBeenCalledTimes(1)
    expect(enterGame).not.toHaveBeenCalled()
    expect(saveIssueReport).toHaveBeenCalledTimes(1)
    expect(saveIssueReport).toHaveBeenCalledWith('corrupted', expect.any(String), undefined, 'remote')
    expect(onError).not.toHaveBeenCalled()
    expect(outcome.status).toBe('failed')
  })
})

// ---------------------------------------------------------------------------
describe('arm C - ID_COLLECTION_CAP coverage gap: Record channels + never-validated hiddenPerfection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('C1 control: a 1025-entry capped array is denied (techniques)', () => {
    const save = makeSave()
    ;(save as unknown as Record<string, unknown>).techniques = Array.from(
      { length: 1025 },
      (_, i) => ({ id: `tech_${i}` }),
    )
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('C2 hiddenBeastKills / hiddenChannelCycles carry unbounded entries past the gate', () => {
    const save = makeSave({
      productionSites: [
        {
          siteId: 'thanh_van_lam',
          level: 1,
          autoRestart: false,
          hiddenChannelCycles: Object.fromEntries(
            Array.from({ length: 2048 }, (_, i) => [`chan_${i}`, i]),
          ),
        },
      ],
    })
    save.player.hiddenBeastKills = Object.fromEntries(
      Array.from({ length: 2048 }, (_, i) => [`beast_${i}`, i]),
    )
    // FIX: both now deny - validateNonNegativeIntMap gained the same
    // count bound the named record maps already had, so these two
    // channels can no longer inflate the payload unbounded.
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('C3 the bloated hiddenBeastKills record restores verbatim and re-emits on every write', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    // FIX: the inflated record no longer reaches the restore seam at
    // all - the new count bound rejects it at admission, so only a
    // 1024-entry (at-cap) payload round-trips.
    const save = makeSave()
    save.player.hiddenBeastKills = Object.fromEntries(
      Array.from({ length: 2048 }, (_, i) => [`beast_${i}`, i]),
    )
    expect(validateGameSaveShape(save).ok).toBe(false)
    save.player.hiddenBeastKills = Object.fromEntries(
      Array.from({ length: 1024 }, (_, i) => [`beast_${i}`, i]),
    )
    const result = restoreGameSession(player, manager, save, undefined)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)

    const repackaged = buildGameSave(player.$state, manager)
    expect(Object.keys(repackaged.player.hiddenBeastKills).length).toBe(1024)
    // Contrast: hiddenPerfection.hiddenBreakthroughRealmIds is NOT a cap
    // gap - restore-side HiddenPerfection integrity rejects non-authored
    // realm ids (and the list is prefix/dedup bounded by the authored
    // hidden realm set), so that channel stays defended on content.
    const poisoned = makeSave()
    poisoned.player.hiddenPerfection.hiddenBreakthroughRealmIds = ['realm_not_authored']
    const freshManager = registeredManager()
    setActivePinia(createPinia())
    const rejected = restoreGameSession(usePlayerStore(), freshManager, poisoned, undefined)
    expect(rejected.status).toBe('rejected')
  })
})

// ---------------------------------------------------------------------------
describe('arm D - wire-form gate (8f3cb237) edge cases', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('D1 a circular snapshot is refused OUTGOING_UNSERIALIZABLE, retryable:false, before the service', async () => {
    const save = makeSave() as unknown as Record<string, unknown>
    save.circular = save // JSON.stringify throws
    const { service, sawSave } = gateRefuseService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()
    const result = await coordinator.save(save as unknown as GameSave)
    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.detail).toBe('OUTGOING_UNSERIALIZABLE')
      expect(result.retryable).toBe(false)
      // FIX: the arm-consistent code is attached here too, so a
      // bypass-fed unserializable payload classifies identically
      // (unreachable for honest payloads: buildGameSave output is
      // plain JSON - kept as a defense arm).
      expect(result.code).toBe('SAVE_INVALID')
    }
    expect(sawSave()).toBe(false)
  })

  it('D2 NaN/Infinite stamps serialize to null in the wire form and are judged as invalid shape', async () => {
    const save = makeSave()
    ;(save.player as unknown as Record<string, unknown>).lastSavedAt = Number.NaN
    const { service, sawSave } = gateRefuseService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()
    const result = await coordinator.save(save)
    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.detail).toBe('OUTGOING_ADMISSION_REJECTED')
    }
    expect(sawSave()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('arm E - rejected attacks and closed siblings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('E1 unknown authority kinds still degrade to zero-accrual live-replacement at the client clock', () => {
    expect(
      sanitizeRestoreAuthority({ kind: 'forged-kind', nowMs: FUTURE } as never),
    ).toEqual({ kind: 'live-replacement', nowMs: NOW })
    expect(
      sanitizeRestoreAuthority({ kind: 'cold-boot', sinceMs: 1, untilMs: 'x' } as never),
    ).toEqual({ kind: 'live-replacement', nowMs: NOW })
  })

  it('E2 autofarm lastCheckedMs re-anchors on restore (closed sibling)', () => {
    const manager = registeredManager()
    const farmStage = {
      id: 'farm_stage',
      name: 'farm_stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: 'stage_probe', weight: 1 }],
      totalEnemyCount: 1,
      waves: [1],
      spawnIntervalSeconds: 0,
    }
    manager.catalogOps.registerStages([farmStage as never])
    const player = createDefaultPlayer()
    primeMortalCreationPick(player, manager.skillManager)
    player.cultivation = 0
    player.cultivationPerSecond = 1
    player.autoFarmStage = { stageId: 'farm_stage', lastCheckedMs: FUTURE }
    const save = buildGameSave(player, manager)
    save.player.lastSavedAt = FUTURE
    save.player.perfectClearStageIds = ['farm_stage']
    save.player.perfectClearSeconds = { farm_stage: 100 }

    const store = usePlayerStore()
    const result = restoreGameSession(store, manager, save, undefined)
    expect(result.status).toBe('ok')
    // Future lastCheckedMs is re-anchored to the client clock - it cannot
    // wedge writes (there is no admission pin on it anyway).
    expect(store.autoFarmStage?.lastCheckedMs ?? 0).toBeLessThanOrEqual(NOW)
  })

  it('E3 quest lastDailyResetAtMs clamps at Date.now() on restore (closed sibling)', () => {
    const store = usePlayerStore()
    const manager = registeredManager()
    const save = makeSave({
      quests: {
        active: [],
        completedOnceIds: [],
        questFlags: [],
        lastDailyResetAtMs: FUTURE,
      },
    })
    const result = restoreGameSession(store, manager, save, undefined)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    expect(manager.questManager.getLastDailyResetAtMs()).toBeLessThanOrEqual(NOW)
  })

  it('E4 decompose nextCycleAt re-anchors at restore (sibling-class): a post-dated deadline clamps to now + cycleMs', async () => {
    const store = usePlayerStore()
    const manager = registeredManager()
    const save = forgedFutureSave()
    const result = restoreGameSession(store, manager, save, undefined)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)

    const repackaged = buildGameSave(store.$state, manager)
    // FIX: nextCycleAt joins the autofarm.lastCheckedMs /
    // quests.lastDailyResetAtMs sibling class - no marker pin, but the
    // restore clamps it to restore-now + cycleMs (the authored max a
    // live deadline can sit out), so the channel resumes instead of
    // idling past every later marker.
    expect(repackaged.decompose?.nextCycleAt).toBeLessThanOrEqual(NOW + 60_000)
    // The slice alone does not fail admission - it is the OTHER verbatim
    // channels that brick the write (A3); removing them makes the write
    // pass while nextCycleAt stays post-dated.
    const isolated = buildGameSave(store.$state, manager)
    isolated.alchemyJobs = []
    isolated.tribulation = undefined
    isolated.productionSites = [
      { siteId: 'thanh_van_lam', level: 1, autoRestart: true },
    ]
    const isolatedShape = validateGameSaveShape(isolated)
    expect(isolatedShape.ok).toBe(true)
  })
})
