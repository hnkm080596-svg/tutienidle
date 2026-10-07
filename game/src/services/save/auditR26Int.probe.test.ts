// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { usePlayerStore } from '../../stores/player'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave, restoreGameSession, type GameSave } from './SaveSystem'
import { resolveSaveKey } from './saveKeys'
import { validateGameSaveShape } from './saveShapeValidation'
import { sanitizeRestoreAuthority } from './saveTypes'
import type { RestoreTimeAuthority } from './saveTypes'
import { CloudSaveCoordinator } from '../cloudSave/CloudSaveCoordinator'
import { LocalCloudSaveService } from '../cloudSave/LocalCloudSaveService'
import type { CloudSaveService, CloudSaveWriteResult } from '../cloudSave/CloudSaveService'
import { authorityStateForError } from '../session/OnlineSessionController'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { QUESTS } from '../../data/quest/quests'
import { EarlyGameSession } from '../../core/simulation/earlygame/EarlyGameSession'
import { CYCLE_BASE_SECONDS_BY_REALM } from '../../core/production/ProductionBalance'
import { TRIBULATION_COOLDOWN_SECONDS } from '../../core/tribulation/TribulationDirector'

// ============================================================================
// QA probe - fixpoint r26 INT wave (audit of commit 8f3cb237, the r25
// adjudication batch + the wire-form gate follow-up).
//
// Seams under audit:
//  (a) driveSave is the single write funnel: inflight, queued promotion,
//      join-or-displace resolvers, conflict retry, generation fencing -
//      every write reaches the gate exactly once, stale-generation queued
//      entries resolve STALE_GENERATION without touching the gate.
//  (b) the 8f3cb237 wire-form gate: JSON.stringify throws (BigInt,
//      circular) resolve OUTGOING_UNSERIALIZABLE/retryable:false; the
//      verdict is judged on the wire bytes (NaN -> null -> refused).
//  (c) refusal envelope vs caller arms: the gate mints {unavailable,
//      detail, retryable:true} with NO `code` - every DATA_REFUSE
//      recovery arm (boot-commit :567, firstSave :690) requires
//      `!retryable && code && DATA_REFUSE_CODES.has(code)` and can never
//      arm on a gate refusal; authorityStateForError maps undefined code
//      to 'reconnecting' (transient pause), not 'recovery'.
//  (d) verbatim-restore reachability under the gate: a consistent +Delta
//      epoch payload still passes admission, restores deadline channels
//      verbatim, and the gate refuses the next honest write - the slot
//      survives but the boot/caller contract above is what wedges.
//  (e) record-cap siblings: ID_COLLECTION_CAP covers the array helpers
//      and 3 named records; the remaining record walks (talentLevels,
//      hiddenBeastKills, nodeFreePurchaseRecord, skillCastCounts,
//      hiddenChannelCycles, nested learnedSkillIds) stay uncapped.
//  (f) authority vocabulary: sanitizeRestoreAuthority whitelist degrade
//      is deny-direction; EarlyGameSession absent-authority stays legacy.
// ============================================================================

const NOW = 1_725_160_000_000
const TWO_POW_52 = 2 ** 52
const HOUR_MS = 3_600_000
const MORTAL_CYCLE_MS = CYCLE_BASE_SECONDS_BY_REALM['mortal']! * 1000

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerBuildings(buildings)
  return manager
}

function makeSave(
  overrides: {
    lastSavedAt?: number
    autoFarmStage?: { stageId: string; lastCheckedMs: number } | null
    autoWorkerCapacity?: number
    productionSites?: GameSave['productionSites']
    tribulation?: GameSave['tribulation']
    quests?: GameSave['quests']
  } = {},
): GameSave {
  const manager = registeredManager()
  const player = createDefaultPlayer()
  primeMortalCreationPick(player, manager.skillManager)
  player.cultivation = 0
  player.cultivationPerSecond = 1
  if (overrides.autoFarmStage !== undefined) {
    player.autoFarmStage = overrides.autoFarmStage
  }
  if (overrides.autoWorkerCapacity !== undefined) {
    player.autoWorkerCapacity = overrides.autoWorkerCapacity
  }
  const save = buildGameSave(player, manager)
  save.player.lastSavedAt = overrides.lastSavedAt ?? NOW
  if (overrides.productionSites !== undefined) {
    save.productionSites = overrides.productionSites
  }
  if (overrides.tribulation !== undefined) {
    save.tribulation = overrides.tribulation
  }
  if (overrides.quests !== undefined) {
    save.quests = overrides.quests
  }
  if (overrides.autoWorkerCapacity !== undefined && overrides.autoWorkerCapacity > 0) {
    // A non-zero persisted capacity requires the chi_hien_quan building
    // witness in the same payload.
    save.buildings = [
      {
        instanceId: 'r26_chq',
        buildingId: 'chi_hien_quan',
        level: 1,
        lastCollectedAt: 0,
      },
    ]
  }
  return save
}

// A deferred Promise so an inflight write can be held while queued
// callers join it.
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function makeService(overrides?: {
  saveImpl?: (save: GameSave, expectedRevision: number) => Promise<CloudSaveWriteResult>
}): { service: CloudSaveService; saveCalls: { snapshot: GameSave; expectedRevision: number }[] } {
  const saveCalls: { snapshot: GameSave; expectedRevision: number }[] = []
  const service: CloudSaveService = {
    capability: 'local-only',
    async load() {
      return { status: 'empty', revision: 0 }
    },
    async save(snapshot, expectedRevision) {
      saveCalls.push({ snapshot, expectedRevision })
      if (overrides?.saveImpl) return overrides.saveImpl(snapshot, expectedRevision)
      return { status: 'ok', revision: expectedRevision + 1 }
    },
  }
  return { service, saveCalls }
}

// Node env has no localStorage: a Map-backed stub for the
// LocalCloudSaveService end-to-end checks.
function installLocalStorageStub() {
  const map = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size
    },
  })
  return map
}

// A deterministic +Delta-epoch save: every persisted stamp shifted
// together so every admission pin is satisfied (the r25 (c) craft).
function plusDeltaSave(delta = HOUR_MS): GameSave {
  return makeSave({
    lastSavedAt: NOW + delta,
    autoWorkerCapacity: 3,
    productionSites: [
      {
        siteId: 'thanh_van_lam',
        level: 1,
        autoRestart: true,
        workerCycles: [
          {
            cycleId: 'r26_wc1',
            siteId: 'thanh_van_lam',
            collectionRealmId: 'mortal',
            siteLevelAtStart: 1,
            rewardTableVersion: 1,
            rollSeed: 12345,
            startedAtMs: NOW + delta - MORTAL_CYCLE_MS,
            completesAtMs: NOW + delta,
          },
        ],
      },
    ],
    tribulation: { cooldownUntil: NOW + delta + 120_000 },
    quests: {
      active: [],
      completedOnceIds: [],
      lastDailyResetAtMs: NOW + delta - 60_000,
      questFlags: [],
    },
  })
}

// ----------------------------------------------------------------------------
// (a) driveSave is the single funnel - every queue path reaches the gate
// ----------------------------------------------------------------------------
describe('seam (a) - every write path funnels through the driveSave gate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('an invalid-shape inflight write is refused before service.save runs', async () => {
    const { service, saveCalls } = makeService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const bad = plusDeltaSave()
    // A consistent +Delta epoch is admission-VALID at boot time; break it
    // the way the next honest write breaks it: fresh lastSavedAt beneath
    // post-dated stamps.
    bad.player.lastSavedAt = NOW

    const result = await coordinator.save(bad)
    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.detail).toBe('OUTGOING_ADMISSION_REJECTED')
      // FIX: the refuse is deterministic for the same in-memory state,
      // so it is non-retryable and carries the data-class code.
      expect(result.retryable).toBe(false)
      expect(result.code).toBe('SAVE_INVALID')
    }
    expect(saveCalls.length).toBe(0)
  })

  it('a queued joiner is gated at promotion - joined resolvers share the refusal', async () => {
    const hold = deferred<CloudSaveWriteResult>()
    const { service, saveCalls } = makeService({ saveImpl: async () => hold.promise })
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const clean = makeSave({ lastSavedAt: NOW })
    const inflightPromise = coordinator.save(clean)
    const queuedBad = plusDeltaSave()
    queuedBad.player.lastSavedAt = NOW
    const queuedPromise = coordinator.save(queuedBad)

    hold.resolve({ status: 'ok', revision: 1 })

    const inflightResult = await inflightPromise
    const queuedResult = await queuedPromise

    expect(inflightResult.status).toBe('ok')
    expect(queuedResult.status).toBe('unavailable')
    if (queuedResult.status === 'unavailable') {
      expect(queuedResult.detail).toBe('OUTGOING_ADMISSION_REJECTED')
    }
    // The inflight write ran once; the queued invalid write never ran.
    expect(saveCalls.length).toBe(1)
  })

  it('a stale-generation queued entry resolves STALE_GENERATION - the gate is never consulted', async () => {
    const hold = deferred<CloudSaveWriteResult>()
    const { service, saveCalls } = makeService({ saveImpl: async () => hold.promise })
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const inflightPromise = coordinator.save(makeSave({ lastSavedAt: NOW }))
    // Queue an INVALID snapshot: if the gate ran before the generation
    // fence, the resolver would see OUTGOING_ADMISSION_REJECTED.
    const invalidQueued = { ...plusDeltaSave() }
    invalidQueued.player.lastSavedAt = NOW
    const queuedPromise = coordinator.save(invalidQueued)

    coordinator.reset()
    hold.resolve({ status: 'ok', revision: 1 })

    const queuedResult = await queuedPromise
    await inflightPromise

    expect(queuedResult.status).toBe('unavailable')
    if (queuedResult.status === 'unavailable') {
      expect(queuedResult.detail).toBe('STALE_GENERATION')
      expect(queuedResult.retryable).toBe(false)
    }
    expect(saveCalls.length).toBe(1)
  })

  it('displaced valid snapshot shares the invalid promoted entry refusal (join-or-displace contract)', async () => {
    const hold = deferred<CloudSaveWriteResult>()
    const { service, saveCalls } = makeService({ saveImpl: async () => hold.promise })
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const inflightPromise = coordinator.save(makeSave({ lastSavedAt: NOW }))
    const firstQueued = coordinator.save(makeSave({ lastSavedAt: NOW }))
    const invalidLatest = { ...plusDeltaSave() }
    invalidLatest.player.lastSavedAt = NOW
    const secondQueued = coordinator.save(invalidLatest)

    hold.resolve({ status: 'ok', revision: 1 })

    const first = await firstQueued
    const second = await secondQueued
    await inflightPromise

    // The displaced (valid) caller resolves with the promoted entry's
    // refusal - documented newest-wins semantics, no dangling resolver.
    expect(first.status).toBe('unavailable')
    expect(second.status).toBe('unavailable')
    expect(saveCalls.length).toBe(1)
  })

  it('conflict retry stays post-gate: same gated snapshot retried once; invalid snapshots never reach the conflict arm', async () => {
    let conflicted = false
    const { service, saveCalls } = makeService({
      saveImpl: async (_s, expectedRevision): Promise<CloudSaveWriteResult> =>
        conflicted
          ? { status: 'ok', revision: expectedRevision + 1 }
          : ((conflicted = true), { status: 'conflict', currentRevision: 0 }),
    })
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const result = await coordinator.save(makeSave({ lastSavedAt: NOW }))
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.recoveredFromConflict).toBe(true)
    }
    // Two service.save calls: first conflict, then the retry over the
    // same (already gated) snapshot.
    expect(saveCalls.length).toBe(2)
    expect(saveCalls[0]?.snapshot).toBe(saveCalls[1]?.snapshot)
  })
})

// ----------------------------------------------------------------------------
// (b) the 8f3cb237 wire-form gate
// ----------------------------------------------------------------------------
describe('seam (b) - the gate judges the wire form, unserializable refused non-retryable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a snapshot JSON.stringify cannot serialize resolves OUTGOING_UNSERIALIZABLE retryable:false', async () => {
    const { service, saveCalls } = makeService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const poisoned = makeSave({ lastSavedAt: NOW }) as unknown as Record<string, unknown>
    poisoned.player = { ...(poisoned.player as object), cultivation: BigInt(7) } as never

    const result = await coordinator.save(poisoned as unknown as GameSave)
    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.detail).toBe('OUTGOING_UNSERIALIZABLE')
      expect(result.retryable).toBe(false)
      expect(result.code).toBe('SAVE_INVALID')
    }
    expect(saveCalls.length).toBe(0)
  })

  it('NaN in-memory becomes null on the wire and is refused there', async () => {
    const { service, saveCalls } = makeService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const save = makeSave({ lastSavedAt: NOW })
    save.player.cultivationPerSecond = Number.NaN

    const result = await coordinator.save(save)
    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.detail).toBe('OUTGOING_ADMISSION_REJECTED')
    }
    expect(saveCalls.length).toBe(0)
  })

  it('an in-memory-only key that wire-serialization drops is judged absent (version undefined -> incompatible)', async () => {
    const { service } = makeService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const save = makeSave({ lastSavedAt: NOW }) as unknown as Record<string, unknown>
    save.version = undefined

    const result = await coordinator.save(save as unknown as GameSave)
    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.detail).toBe('OUTGOING_ADMISSION_REJECTED')
    }
  })
})

// ----------------------------------------------------------------------------
// (c) the refusal envelope vs the caller arms that must see it
// ----------------------------------------------------------------------------
describe('seam (c) - the gate refusal cannot arm the DATA_REFUSE recovery surfaces', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('the refused result now arms the DATA_REFUSE surface: non-retryable + SAVE_INVALID code', async () => {
    const { service } = makeService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()

    const wedged = plusDeltaSave()
    wedged.player.lastSavedAt = NOW

    const commit = await coordinator.save(wedged)
    expect(commit.status).toBe('unavailable')
    if (commit.status !== 'unavailable') return

    // Mirrors useAppLifecycle.ts boot-commit arm (:567-582) and the
    // firstSave arm (:690-705): the recovery surface requires
    // `!retryable && code && DATA_REFUSE_CODES.has(code)`.
    const DATA_REFUSE_CODES = new Set(['SAVE_INVALID', 'SAVE_TOO_LARGE'])
    const armsRecovery =
      commit.status === 'unavailable' &&
      !commit.retryable &&
      commit.code !== undefined &&
      DATA_REFUSE_CODES.has(commit.code)

    // FIX: the refuse is now exactly what the arms were built for -
    // retryable:false + code SAVE_INVALID satisfies the predicate, so
    // the corrupted-save surface (remote reset + payload export) mounts
    // instead of looping generic onError + boot.fail() forever.
    expect(armsRecovery).toBe(true)
    expect(commit.code).toBe('SAVE_INVALID')
    expect(commit.retryable).toBe(false)

    // And authorityStateForError maps the armed code to terminal
    // 'recovery', not the transient reconnect path.
    expect(authorityStateForError(commit.code)).toBe('recovery')
  })
})

// ----------------------------------------------------------------------------
// (d) verbatim-restore reachability under the gate - the consistent wedge
// ----------------------------------------------------------------------------
describe('seam (d) - consistent +Delta epoch passes admission, wedges the writer, slot survives', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('+Delta payload: admission ok, verbatim restore, next write refused - and the healthy local slot survives', async () => {
    const store = installLocalStorageStub()
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)

    // Step 1 - a healthy write lands in the slot via the real local tier.
    const healthy = makeSave({ lastSavedAt: NOW - 30_000 })
    const service = new LocalCloudSaveService()
    const coordinator = new CloudSaveCoordinator(service)
    await coordinator.load()
    const write1 = await coordinator.save(healthy)
    expect(write1.status).toBe('ok')
    const slotBytes = store.get(resolveSaveKey()) ?? ''

    // Step 2 - the consistent +Delta epoch payload passes the same
    // admission the boot gate applies (self-consistent epoch, every pin
    // satisfied).
    const crafted = plusDeltaSave()
    expect(validateGameSaveShape(crafted).ok).toBe(true)

    // Step 3 - restore it: FIX - deadline channels re-anchor at the
    // restore clock. The post-dated cycle head shifts its pair to
    // startedAt=now (span preserved); the post-dated cooldown clamps at
    // the authored max-remaining (now + 300s).
    const restored = restoreGameSession(player, manager, crafted)
    expect(restored.status).toBe('ok')
    const site = manager.productionSystem
      .getAllStates()
      .find((s) => s.siteId === 'thanh_van_lam')
    expect(site?.workerCycles?.[0]?.startedAtMs).toBe(NOW)
    expect(site?.workerCycles?.[0]?.completesAtMs).toBe(NOW + MORTAL_CYCLE_MS)
    expect(manager.tribulationDirector.serializeRuntime()?.cooldownUntil).toBe(
      NOW + TRIBULATION_COOLDOWN_SECONDS * 1000,
    )

    // Step 4 - the next honest write commits: no post-dated stamp
    // survives restore anymore, so the repackaged payload validates and
    // lands in the slot (the self-brick wedge is gone at the source).
    const repacked = buildGameSave(player.$state, manager)
    expect(validateGameSaveShape(repacked).ok).toBe(true)
    const committed = await coordinator.save(repacked)
    expect(committed.status).toBe('ok')
    const slotAfter = store.get(resolveSaveKey()) ?? ''
    expect(slotAfter).not.toBe(slotBytes)
  })

  it('healed channels clamp at restore: quest lastDailyResetAtMs and autoFarm lastCheckedMs land <= now', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)

    const save = makeSave({
      lastSavedAt: NOW + HOUR_MS,
      autoFarmStage: { stageId: 'mock_stage', lastCheckedMs: NOW + HOUR_MS },
      quests: {
        active: [],
        completedOnceIds: [],
        lastDailyResetAtMs: NOW + HOUR_MS - 60_000,
        questFlags: [],
      },
    })
    const result = restoreGameSession(player, manager, save)
    expect(result.status).toBe('ok')

    expect(manager.questManager.getState().lastDailyResetAtMs).toBeLessThanOrEqual(NOW)
    expect(player.$state.autoFarmStage?.lastCheckedMs ?? 0).toBeLessThanOrEqual(NOW)
  })
})

// ----------------------------------------------------------------------------
// (e) record-cap siblings left uncapped by the ID_COLLECTION_CAP batch
// ----------------------------------------------------------------------------
describe('seam (e) - uncapped record walks remain after the ID_COLLECTION_CAP batch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('capped channels still reject (control): nodeLevels/nodeOneShotGrants/perfectClearSeconds at 1025 entries', () => {
    const over = Object.fromEntries(Array.from({ length: 1_025 }, (_, i) => [`crafted_${i}`, 1]))
    for (const patch of [
      (s: GameSave) => { s.player.nodeLevels = over },
      (s: GameSave) => {
        s.player.nodeOneShotGrants = Object.fromEntries(
          Array.from({ length: 1_025 }, (_, i) => [`n_${i}`, {}]),
        )
      },
      (s: GameSave) => { s.player.perfectClearSeconds = over },
    ]) {
      const save = makeSave({ lastSavedAt: NOW })
      patch(save)
      expect(validateGameSaveShape(save).ok).toBe(false)
    }
  })

  it('uncapped records validate with 2000 crafted entries: hiddenBeastKills, nodeFreePurchaseRecord, skillCastCounts', () => {
    const record = Object.fromEntries(Array.from({ length: 2_000 }, (_, i) => [`crafted_${i}`, 1]))

    for (const patch of [
      (s: GameSave) => { s.player.hiddenBeastKills = record },
      (s: GameSave) => { s.player.nodeFreePurchaseRecord = record },
      (s: GameSave) => { (s.player as { skillCastCounts?: Record<string, number> }).skillCastCounts = record },
    ]) {
      const save = makeSave({ lastSavedAt: NOW })
      patch(save)
      // FIX: all three records now carry the same ID_COLLECTION_CAP
      // count bound - the 2000-entry crafted map refuses at admission.
      expect(validateGameSaveShape(save).ok).toBe(false)
    }
  })

  it('talentLevels: r27 root cap fires on >1024 keys; unowned entries still fail the ownership pin below it', () => {
    const record = Object.fromEntries(Array.from({ length: 2_000 }, (_, i) => [`crafted_${i}`, 1]))
    const save = makeSave({ lastSavedAt: NOW })
    save.player.talentLevels = record
    // r27-COR-3: the record now shares the ID_COLLECTION_CAP root bound
    // - a 2000-entry crafted map refuses on count before any entry walk.
    const verdict = validateGameSaveShape(save)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(
        verdict.issues.some(
          (issue) =>
            issue.path === 'player.talentLevels' && issue.message.includes('ID_COLLECTION_CAP'),
        ),
      ).toBe(true)
    }

    // Below the cap the ownership pin still guards: every level entry
    // must belong to a selected talent.
    const small = makeSave({ lastSavedAt: NOW })
    small.player.talentLevels = { crafted_unowned: 1 }
    const smallVerdict = validateGameSaveShape(small)
    expect(smallVerdict.ok).toBe(false)
    if (!smallVerdict.ok) {
      expect(
        smallVerdict.issues.some((issue) =>
          issue.path.startsWith('player.talentLevels.'),
        ),
      ).toBe(true)
    }
  })

  it('uncapped nested walks: nodeOneShotGrants[].learnedSkillIds and productionSites[].hiddenChannelCycles', () => {
    const save = makeSave({
      lastSavedAt: NOW,
      autoWorkerCapacity: 3,
      productionSites: [
        {
          siteId: 'thanh_van_lam',
          level: 1,
          autoRestart: true,
          hiddenChannelCycles: Object.fromEntries(
            Array.from({ length: 2_000 }, (_, i) => [`hc_${i}`, 1]),
          ),
        },
      ],
    })
    save.player.nodeOneShotGrants = {
      n_crafted: {
        learnedSkillIds: Array.from({ length: 2_000 }, (_, i) => `skill_${i}`),
      },
    }
    // FIX: both nested walks now hit the count bound (hiddenChannelCycles
    // via validateNonNegativeIntMap, learnedSkillIds inline).
    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// (f) authority vocabulary consistency - all degrade arms are deny-direction
// ----------------------------------------------------------------------------
describe('seam (f) - authority degrade arms share the deny-direction vocabulary', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a foreign authority kind degrades to live-replacement at the sanitizer whitelist', () => {
    const foreign = { kind: 'window-grant', sinceMs: NOW - 1_000, untilMs: TWO_POW_52 } as unknown as RestoreTimeAuthority
    const sanitized = sanitizeRestoreAuthority(foreign)
    expect(sanitized).toEqual({ kind: 'live-replacement', nowMs: NOW })
  })

  it('EarlyGameSession absent-authority restore keeps the legacy client window (local-only seam)', () => {
    const player = usePlayerStore()
    const session = new EarlyGameSession({
      seed: 13,
      profile: { name: 'r26_probe', talentIds: ['hap_linh'] },
    })
    const save = makeSave({ lastSavedAt: NOW - 3_600_000 })
    const result = session.restoreCheckpoint(save, player)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.offline.elapsedSeconds).toBe(3_600)
    }
  })
})
