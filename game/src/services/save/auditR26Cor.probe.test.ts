// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import { sanitizeRestoreAuthority } from './saveTypes'
import type { GameSave, RestoreTimeAuthority } from './saveTypes'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { CloudSaveCoordinator } from '../cloudSave/CloudSaveCoordinator'
import type { CloudSaveService, CloudSaveWriteResult } from '../cloudSave/CloudSaveService'
import { primeMortalCreationPick } from './GameSave.fixture'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'
import { alchemySecondsFor } from '../../core/alchemy/AlchemySystem'
import { TRIBULATION_COOLDOWN_SECONDS } from '../../core/tribulation/TribulationDirector'
import { TU_LINH_TRAN_DURATION_MS } from '../../core/economy/TuLinhTranBalance'

// ============================================================================
// QA probe - fixpoint r26 COR wave. Audits the r25 adjudication batch at
// 8f3cb237 (3588ebf9 + the wire-form driveSave follow-up):
//
//   (D) driveSave write-side gate: validates the WIRE form
//       (JSON.parse(JSON.stringify(snapshot))), refuses shape-failures with
//       OUTGOING_ADMISSION_REJECTED (retryable) and unserializable payloads
//       with OUTGOING_UNSERIALIZABLE (retryable:false), all BEFORE
//       service.save runs. Probes pin: honest builds pass, the refuse keeps
//       the slot, joined/queued callers still resolve, and the promoted
//       entry re-runs its own gate.
//   (W) residual self-brick surface: validator pins startedAtMs /
//       cooldownUntil <= save.player.lastSavedAt(+span), but the restore
//       seams copy those stamps VERBATIM (AlchemySystem.restoreJobs,
//       ProductionSystem.restoreStates, TribulationDirector.restoreRuntime).
//       A payload whose stamps sit above its own lastSavedAt admits at
//       load, restores verbatim, then the next write stamps
//       lastSavedAt=Date.now() beneath them and the gate refuses -
//       forever if the stamps are far enough out. Probes pin the admit ->
//       verbatim -> refuse chain.
//   (C) ID_COLLECTION_CAP=1024 coverage: capped channels refuse >1024;
//       the uncapped sibling records (baseStats, nodeFreePurchaseRecord)
//       still admit unbounded key counts.
//   (G) authority seam: sanitizeRestoreAuthority whitelist/degrade arms,
//       non-remote callers keep the legacy client window (undefined stays
//       the absent marker), and the r25 Date.now() clamps pull a
//       skewed-writer timed effect back into domain (deny-consistent, the
//       honest skew is absorbed not wedged).
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000

let currentMs = 1_725_160_000_000

function buildMinimalSave(playerOverrides: Record<string, unknown>): GameSave {
  const base = {
    name: 'Test',
    realmId: 'mortal',
    realmLevel: 1,
    cultivation: 0,
    cultivationPerSecond: 1,
    baseStats: {},
    modifiers: [],
    externalModifiers: [],
    spiritStone: 0,
    selectedTalentIds: [],
    hasSeenTutorial: false,
    totalCultivationGained: 0,
    bossKillCount: 0,
    skillInsight: 0,
    totalSkillInsightGained: 0,
    attributePoints: 0,
    nodeLevels: {},
    purchasedNodeIds: [],
    completedStageIds: [],
    bodyProgression: {
      body_refinement: { completedTiers: 0, currentTierProgress: 0 },
      meridian: { openedIds: [] },
    },
    physiqueGrade: 'pham',
    breakthroughGrade: 6,
    grantedRealmPassiveIds: [],
    persistentTimedEffects: [],
    refinementPoints: 100,
    lastRefinementRegenAtMs: currentMs,
    lastSavedAt: currentMs,
  }

  return { player: { ...base, ...playerOverrides } } as unknown as GameSave
}

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

/** A real writer-produced save in wire form - the only fixture shape
 *  that is guaranteed validateGameSaveShape-clean at this commit
 *  (buildMinimalSave covers the restore seam, not the admission gate:
 *  it lacks `version` and the post-v87 player fields). */
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

describe('auditR26 COR probe - driveSave write gate (D)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('D1 honest buildGameSave payloads pass the wire-form gate (fresh + mid-game)', () => {
    // Fresh pre-creation-pick state - the firstSave arm must be able to
    // commit or no remote character could ever be created.
    const fresh = registeredManager()
    const freshPlayer = createDefaultPlayer()
    fresh.setActivePlayer(freshPlayer)
    const freshWire = JSON.parse(JSON.stringify(buildGameSave(freshPlayer, fresh))) as GameSave
    const freshShape = validateGameSaveShape(freshWire)
    expect(freshShape.ok).toBe(true)
    expect(freshShape.issues).toHaveLength(0)

    // Mid-game state carrying the workload slices the gate also judges:
    // a pill_room, an alchemy job, and a tribulation cooldown.
    const recipe = alchemyRecipes.find((r) => r.id === 'alchemy_tu_linh_dan_mortal')!
    const variant = recipe.herbVariants[0]!
    const writer = registeredManager()
    const writerPlayer = createDefaultPlayer()
    writer.setActivePlayer(writerPlayer)
    primeMortalCreationPick(writerPlayer, writer.skillManager)
    writer.buildingManager.add({
      instanceId: 'b-pill',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
    })
    const span = alchemySecondsFor(recipe, 1) * 1000
    writer.alchemySystem.restoreJobs([
      alchemyJobFixture(
        {
          jobId: 'r26_d1',
          recipeId: recipe.id,
          pillId: recipe.pillId,
          herbMaterialId: variant.materialId,
          startedAtMs: currentMs - 60_000,
          completesAtMs: currentMs - 60_000 + span,
          roomLevelAtStart: 1,
        },
        undefined,
        recipe,
      ),
    ])
    writer.tribulationDirector.restoreRuntime({
      cooldownUntil: currentMs + TRIBULATION_COOLDOWN_SECONDS * 1000,
    })

    const wire = JSON.parse(JSON.stringify(buildGameSave(writerPlayer, writer))) as GameSave
    const shape = validateGameSaveShape(wire)
    expect(shape.ok).toBe(true)
    expect(shape.issues).toHaveLength(0)
  })

  it('D2 a shape-invalid snapshot is refused before service.save - the slot is preserved', async () => {
    const { service, saveCalls } = mockService('local')
    const coordinator = new CloudSaveCoordinator(service)

    const wire = validWireSave()
    wire.player.lastSavedAt = currentMs
    // appliedAtMs after the save's own lastSavedAt - provably impossible
    // provenance; the gate must refuse before the adapter writes.
    wire.player.persistentTimedEffects = [
      {
        id: 'fx',
        sourceItemId: 'tu_linh_tran',
        effectGroup: 'tu_linh_tran',
        appliedAtMs: currentMs + 1,
        expiresAtMs: currentMs + 1000,
        modifiers: [],
        cultivationSpeedPercent: 0.25,
      },
    ]

    const result = await coordinator.save(wire)
    expect(result).toEqual({
      status: 'unavailable',
      message: 'save tự vi phạm cổng nhận - giữ nguyên slot hiện tại',
      retryable: true,
      detail: 'OUTGOING_ADMISSION_REJECTED',
    })
    expect(saveCalls).toHaveLength(0)
    // The refuse carries NO BackendErrorCode - downstream classification
    // (authorityStateForError) sees undefined, i.e. 'reconnecting'.
    expect((result as { code?: string }).code).toBeUndefined()
  })

  it('D3 an unserializable snapshot refuses with OUTGOING_UNSERIALIZABLE (retryable:false)', async () => {
    const { service, saveCalls } = mockService('local')
    const coordinator = new CloudSaveCoordinator(service)

    const circular: Record<string, unknown> = {}
    circular.self = circular
    const snapshot = buildMinimalSave({ lastSavedAt: currentMs })
    ;(snapshot.player as unknown as Record<string, unknown>).circular = circular

    const result = await coordinator.save(snapshot)
    expect(result).toEqual({
      status: 'unavailable',
      message: 'save không serialize được - giữ nguyên slot hiện tại',
      retryable: false,
      detail: 'OUTGOING_UNSERIALIZABLE',
    })
    expect(saveCalls).toHaveLength(0)
  })

  it('D4 joined callers share the refused result; a promoted queued entry runs its own gate', async () => {
    // Controllable adapter: first save stays inflight until released.
    const saveCalls: GameSave[] = []
    let release!: (r: CloudSaveWriteResult) => void
    const gate = new Promise<CloudSaveWriteResult>((resolve) => {
      release = resolve
    })
    const service = {
      capability: 'local',
      load: async () => ({ status: 'empty' as const, revision: 0 }),
      save: (save: GameSave) => {
        saveCalls.push(save)
        return gate
      },
    } as unknown as CloudSaveService
    const coordinator = new CloudSaveCoordinator(service)

    const good = validWireSave()
    const inflight = coordinator.save(good)

    // Two callers join while inflight: the second displaces the first's
    // snapshot; the promoted entry carries the NEWEST snapshot.
    const joinedA = coordinator.save(validWireSave())
    const poisoned = validWireSave()
    poisoned.player.lastSavedAt = currentMs
    poisoned.player.persistentTimedEffects = [
      {
        id: 'fx',
        sourceItemId: 'tu_linh_tran',
        effectGroup: 'tu_linh_tran',
        appliedAtMs: currentMs + 10_000,
        expiresAtMs: currentMs + 20_000,
        modifiers: [],
        cultivationSpeedPercent: 0.25,
      },
    ]
    const joinedB = coordinator.save(poisoned)

    release({ status: 'ok', revision: 1 })

    const [r0, rA, rB] = await Promise.all([inflight, joinedA, joinedB])
    expect(r0.status).toBe('ok')
    // The promoted entry ran the gate on the poisoned snapshot - both
    // joined callers resolve with ITS refuse, and the adapter saw only
    // the inflight write.
    expect(rA).toEqual(rB)
    expect(rA.status).toBe('unavailable')
    expect((rA as { detail?: string }).detail).toBe('OUTGOING_ADMISSION_REJECTED')
    expect(saveCalls).toHaveLength(1)
  })
})

describe('auditR26 COR probe - verbatim-stamp self-brick residual (W)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('W1 tribulation.cooldownUntil: skewed payload admits at load, restores verbatim, bricks the next write', () => {
    // A save written under a +1h skewed clock (or synced from a machine
    // running ahead): lastSavedAt and cooldownUntil sit 1h past real-now.
    // cooldownUntil <= lastSavedAt + authored-span admits it - the pin
    // compares the stamp to the payload's OWN marker, not real time.
    const skew = 3600_000
    const writer = registeredManager()
    const writerPlayer = createDefaultPlayer()
    writer.setActivePlayer(writerPlayer)
    primeMortalCreationPick(writerPlayer, writer.skillManager)
    writer.tribulationDirector.restoreRuntime({
      cooldownUntil: currentMs + skew + TRIBULATION_COOLDOWN_SECONDS * 1000,
    })
    const wire = JSON.parse(JSON.stringify(buildGameSave(writerPlayer, writer))) as GameSave
    wire.player.lastSavedAt = currentMs + skew

    const admitted = validateGameSaveShape(wire)
    expect(admitted.ok).toBe(true)

    // The restore seam copies the deadline verbatim - no clamp exists.
    const reader = registeredManager()
    const readerPlayer = createDefaultPlayer()
    reader.setActivePlayer(readerPlayer)
    reader.saveOps.restoreFromSave(wire, undefined)
    const restoredSlice = reader.tribulationDirector.serializeRuntime()
    expect(restoredSlice.cooldownUntil).toBe(currentMs + skew + TRIBULATION_COOLDOWN_SECONDS * 1000)

    // The reader's next write stamps lastSavedAt = real-now BELOW the
    // restored deadline -> the pin now trips and the gate refuses. This
    // is deterministic-invalid for the skew horizon (permanent for a
    // far-future crafted stamp).
    const rebuilt = JSON.parse(
      JSON.stringify(buildGameSave(readerPlayer, reader)),
    ) as GameSave
    rebuilt.player.lastSavedAt = currentMs // what player.save stamps
    const refused = validateGameSaveShape(rebuilt)
    expect(refused.ok).toBe(false)
    expect(
      refused.issues.some((issue) => issue.path === '.tribulation.cooldownUntil'),
    ).toBe(true)
  })

  it('W2 alchemyJobs[].startedAtMs: identical verbatim-restore class through the job channel', () => {
    const recipe = alchemyRecipes.find((r) => r.id === 'alchemy_tu_linh_dan_mortal')!
    const variant = recipe.herbVariants[0]!
    const skew = 3600_000
    const span = alchemySecondsFor(recipe, 1) * 1000

    const writer = registeredManager()
    const writerPlayer = createDefaultPlayer()
    writer.setActivePlayer(writerPlayer)
    primeMortalCreationPick(writerPlayer, writer.skillManager)
    writer.buildingManager.add({
      instanceId: 'b-pill',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
    })
    // Pair stays span-coherent under the skew - admission admits it.
    writer.alchemySystem.restoreJobs([
      alchemyJobFixture(
        {
          jobId: 'r26_w2',
          recipeId: recipe.id,
          pillId: recipe.pillId,
          herbMaterialId: variant.materialId,
          startedAtMs: currentMs + skew - 60_000,
          completesAtMs: currentMs + skew - 60_000 + span,
          roomLevelAtStart: 1,
        },
        undefined,
        recipe,
      ),
    ])
    const wire = JSON.parse(JSON.stringify(buildGameSave(writerPlayer, writer))) as GameSave
    wire.player.lastSavedAt = currentMs + skew

    const admitted = validateGameSaveShape(wire)
    expect(admitted.ok).toBe(true)

    // Verbatim restore: the job's stamps land untouched in live state.
    const reader = registeredManager()
    const readerPlayer = createDefaultPlayer()
    reader.setActivePlayer(readerPlayer)
    reader.saveOps.restoreFromSave(wire, undefined)
    const restoredJob = reader.alchemySystem.getJobs()[0]!
    expect(restoredJob.startedAtMs).toBe(currentMs + skew - 60_000)

    // Next write: lastSavedAt = real-now < startedAtMs -> the pin trips.
    const rebuilt = JSON.parse(JSON.stringify(buildGameSave(readerPlayer, reader))) as GameSave
    rebuilt.player.lastSavedAt = currentMs
    const refused = validateGameSaveShape(rebuilt)
    expect(refused.ok).toBe(false)
    expect(
      refused.issues.some((issue) =>
        issue.path.startsWith('alchemyJobs[0].startedAtMs'),
      ),
    ).toBe(true)
  })
})

describe('auditR26 COR probe - ID cap coverage (C)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('C1 capped channels refuse >1024 entries (array + record forms)', () => {
    const capped = validWireSave()
    capped.player.purchasedNodeIds = Array.from(
      { length: 1025 },
      (_v, i) => `node_${i}`,
    )
    const cappedShape = validateGameSaveShape(
      JSON.parse(JSON.stringify(capped)) as GameSave,
    )
    expect(cappedShape.ok).toBe(false)
    expect(
      cappedShape.issues.some((issue) => issue.path === 'player.purchasedNodeIds'),
    ).toBe(true)

    const bigLevels: Record<string, number> = {}
    for (let i = 0; i < 1025; i += 1) bigLevels[`node_${i}`] = 1
    const cappedRecord = validWireSave()
    cappedRecord.player.nodeLevels = bigLevels
    const cappedRecordShape = validateGameSaveShape(
      JSON.parse(JSON.stringify(cappedRecord)) as GameSave,
    )
    expect(cappedRecordShape.ok).toBe(false)
    expect(
      cappedRecordShape.issues.some((issue) => issue.path === 'player.nodeLevels'),
    ).toBe(true)
  })

  it('C2 uncapped sibling records still admit >1024 keys (coverage gap vs the uniform claim)', () => {
    const bigStats: Record<string, number> = {}
    for (let i = 0; i < 1025; i += 1) bigStats[`forged_stat_${i}`] = 1
    const withStats = validWireSave()
    withStats.player.baseStats = bigStats as unknown as typeof withStats.player.baseStats
    const statsShape = validateGameSaveShape(
      JSON.parse(JSON.stringify(withStats)) as GameSave,
    )
    // baseStats walks entries for finite values only - key COUNT is
    // unbounded, so the crafted map still admits (deny-direction only:
    // restore whitelists StatType keys, so it self-heals on next write).
    expect(statsShape.ok).toBe(true)

    const bigFree: Record<string, number> = {}
    for (let i = 0; i < 1025; i += 1) {
      bigFree[`node_${i}`] = 1
    }
    const withFree = validWireSave()
    withFree.player.nodeFreePurchaseRecord = bigFree
    const freeShape = validateGameSaveShape(
      JSON.parse(JSON.stringify(withFree)) as GameSave,
    )
    // nodeFreePurchaseRecord: values must be finite >=0, nothing else -
    // no key cap; the forged record persists verbatim at restore.
    expect(freeShape.ok).toBe(true)
  })
})

describe('auditR26 COR probe - authority seam + Date.now() clamps (G)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('G1 sanitizeRestoreAuthority: whitelisted kinds pass, foreign kinds and bad stamps degrade', () => {
    const coldBoot: RestoreTimeAuthority = {
      kind: 'cold-boot',
      sinceMs: currentMs - DAY_MS,
      untilMs: currentMs,
    }
    expect(sanitizeRestoreAuthority(coldBoot)).toBe(coldBoot)

    const live: RestoreTimeAuthority = { kind: 'live-replacement', nowMs: currentMs }
    expect(sanitizeRestoreAuthority(live)).toBe(live)

    // A kind outside the whitelist never falls through to a stamp read.
    expect(
      sanitizeRestoreAuthority({ kind: 'totally-other' } as unknown as RestoreTimeAuthority),
    ).toEqual({ kind: 'live-replacement', nowMs: currentMs })

    // Corrupt stamps on a whitelisted kind degrade the same way.
    expect(
      sanitizeRestoreAuthority({ kind: 'cold-boot', sinceMs: 2 ** 53, untilMs: currentMs }),
    ).toEqual({ kind: 'live-replacement', nowMs: currentMs })
    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: Number.NaN }),
    ).toEqual({ kind: 'live-replacement', nowMs: currentMs })

    // undefined stays reserved for the absent arm (legacy client window).
    expect(sanitizeRestoreAuthority(undefined)).toBeUndefined()

    // Nit: a null-ish input crashes before the whitelist can degrade it.
    // Unreachable today - both producers build object authorities - but
    // the param accepts it at runtime (JSON-parsed caller input).
    expect(() =>
      sanitizeRestoreAuthority(null as unknown as RestoreTimeAuthority),
    ).toThrow(TypeError)
  })

  it('G2 non-remote callers keep the legacy client window; live-replacement still denies', () => {
    const save = buildMinimalSave({ lastSavedAt: currentMs - 10 * DAY_MS })

    // Non-remote (local) restore with NO authority mints the old client
    // window: elapsed seconds over the payload marker - unchanged by r25.
    const localResult = usePlayerStore().restoreFromSave(save, undefined)
    expect(localResult.elapsedSeconds).toBeGreaterThan(0)

    // The deny primitive a remote+absent-authority degrade now mints:
    // zero accrual on the identical payload.
    setActivePinia(createPinia())
    const denied = usePlayerStore().restoreFromSave(
      buildMinimalSave({ lastSavedAt: currentMs - 10 * DAY_MS }),
      { kind: 'live-replacement', nowMs: currentMs },
    )
    expect(denied.elapsedSeconds).toBe(0)
  })

  it('G3 the r25 clamps absorb honest cross-machine skew: a future-stamped live effect re-domains, not wedges', () => {
    // Writer clock +1h ahead of reader: the TLT effect's appliedAtMs sits
    // past real-now but inside the payload marker; restore clamps it
    // back to now (deny-consistent skew correction) and the deadline to
    // provenance+24h - the rebuilt write validates clean.
    const skew = 3600_000
    const writerNow = currentMs + skew
    const save = buildMinimalSave({ lastSavedAt: writerNow })
    save.player.persistentTimedEffects = [
      {
        id: 'fx-skew',
        sourceItemId: 'tu_linh_tran',
        effectGroup: 'tu_linh_tran',
        appliedAtMs: writerNow - 60_000, // written 1min ago on the skewed clock
        expiresAtMs: writerNow - 60_000 + TU_LINH_TRAN_DURATION_MS,
        modifiers: [],
        cultivationSpeedPercent: 0.25,
      },
    ]

    const store = usePlayerStore()
    store.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: writerNow - DAY_MS,
      untilMs: writerNow, // server 'until' bounded at the skewed save
    })

    const persisted = store.persistentTimedEffects[0]!
    // appliedAtMs was clamped to <= real-now (r25 third operand).
    expect(persisted.appliedAtMs).toBeLessThanOrEqual(currentMs)
    // Live arm: expires bounded by provenance + authored duration.
    expect(persisted.expiresAtMs).toBeLessThanOrEqual(writerNow + TU_LINH_TRAN_DURATION_MS)

    // The rebuilt write passes the gate the verbatim channels trip.
    const rebuilt = JSON.parse(
      JSON.stringify({ player: { ...store.$state, lastSavedAt: currentMs } }),
    ) as GameSave
    const shape = validateGameSaveShape(rebuilt)
    const effectIssues = shape.issues.filter((issue) =>
      issue.path.includes('persistentTimedEffects'),
    )
    expect(effectIssues).toHaveLength(0)
  })
})
