// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { usePlayerStore } from '../../stores/player'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave, restoreGameSession, type GameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { sanitizeRestoreAuthority } from './saveTypes'
import type { RestoreTimeAuthority } from './saveTypes'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { QUESTS } from '../../data/quest/quests'
import { EarlyGameSession } from '../../core/simulation/earlygame/EarlyGameSession'
import { CYCLE_BASE_SECONDS_BY_REALM } from '../../core/production/ProductionBalance'

// ============================================================================
// QA probe - fixpoint r25 INT wave (audit of commit 2a3f95a9, the r24
// adjudication batch):
//  * sanitizeRestoreAuthority: a present-but-corrupt authority degrades to
//    {kind:'live-replacement', nowMs: Date.now()} - evaluated per consumer.
//  * settleNowMs = Math.min(lastSavedAt + elapsed*1000, authorityNowMs,
//    Date.now()) inside GameManagerSaveRestore.
//  * QUEST_LIST_CAP=1024 on quests.active / completedOnceIds / questFlags.
//
// Seams under audit:
//  (a) restoreGameSession hands ONE authority object to both restore
//      bodies - same input, same sanitize outcome class.
//  (b) the degrade stamps each body's own Date.now() - distinct nowMs,
//      same zero-accrual semantics end-to-end.
//  (c) a consistent +Δ-epoch payload (all stamps shifted together)
//      passes every admission pin, restores deadline channels verbatim,
//      and the NEXT honest write self-rejects: the reader-side
//      `startedAtMs > lastSavedAt` pin fires on the re-persisted head.
//      R25-INT-01 repro.
//  (d) an honored cold-boot with untilMs > Date.now(): the player side
//      pays the full approved span while stamp-bearing channels clamp at
//      real now - deferred dues then collect at real wall time.
//  (e) EarlyGameSession.restoreCheckpoint supplies no authority: the
//      legacy client window applies to both sides unchanged.
//  (f) QUEST_LIST_CAP vs honest quest flows (roster bound vs cap).
//  (g) payload-identity caches post-fix: the deny-only claim re-verified
//      on BOTH sides (player lastRestoredPayloads + manager
//      lastAppliedPayloadHash), including no double grant on replay.
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
    // F-W-16: a non-zero persisted capacity requires the chi_hien_quan
    // building witness in the same payload.
    save.buildings = [
      {
        instanceId: 'r25_chq',
        buildingId: 'chi_hien_quan',
        level: 1,
        lastCollectedAt: 0,
      },
    ]
  }
  return save
}

const corruptAuthority = (sinceMs = NOW - 600_000): RestoreTimeAuthority => ({
  kind: 'cold-boot',
  sinceMs,
  untilMs: TWO_POW_52,
})

// ----------------------------------------------------------------------------
// (a) one authority object, two consumers
// ----------------------------------------------------------------------------
describe('seam (a) - the same authority object reaches both restore bodies', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('restoreGameSession passes the identical reference to both bodies; a corrupt stamp zeroes both sides', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    const save = makeSave({ lastSavedAt: NOW - 600_000 })
    const authority = corruptAuthority()

    const playerSpy = vi.spyOn(player, 'restoreFromSave')
    const managerSpy = vi.spyOn(manager.saveOps, 'restoreFromSave')

    const result = restoreGameSession(player, manager, save, authority)

    expect(result.status).toBe('ok')
    expect(playerSpy).toHaveBeenCalledTimes(1)
    expect(managerSpy).toHaveBeenCalledTimes(1)
    // No per-consumer re-read / re-wrap: the SAME object flows through.
    expect(playerSpy.mock.calls[0]?.[1]).toBe(authority)
    expect(managerSpy.mock.calls[0]?.[1]).toBe(authority)
    if (result.status === 'ok') {
      // Zero-accrual degrade end-to-end: no cultivation, and the
      // manager settle skipped the >60s gate entirely.
      expect(result.offline.elapsedSeconds).toBe(0)
      expect(result.offline.cultivation).toBe(0)
    }
  })

  it('absent authority also reaches both bodies as the same undefined', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    const save = makeSave({ lastSavedAt: NOW - 120_000 })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    const result = restoreGameSession(player, manager, save)

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      // Legacy client window: min(real gap, 24h cap) = 120s.
      expect(result.offline.elapsedSeconds).toBe(120)
    }
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 120)
  })
})

// ----------------------------------------------------------------------------
// (b) per-consumer degrade stamps - distinct nowMs, identical semantics
// ----------------------------------------------------------------------------
describe('seam (b) - degrade evaluates each body\'s own Date.now()', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('two sanitize calls stamp their own nowMs; both degrade to live-replacement zero-accrual', () => {
    const spy = vi.spyOn(Date, 'now')
    spy.mockReturnValueOnce(NOW).mockReturnValueOnce(NOW + 1_000)

    const d1 = sanitizeRestoreAuthority(corruptAuthority())
    const d2 = sanitizeRestoreAuthority(corruptAuthority())

    expect(d1).toEqual({ kind: 'live-replacement', nowMs: NOW })
    expect(d2).toEqual({ kind: 'live-replacement', nowMs: NOW + 1_000 })
  })

  it('end-to-end: player body under T1 and manager body under T2 both land zero-accrual', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 600_000 })

    // Player body with the degrade stamping T1.
    const spy = vi.spyOn(Date, 'now')
    spy.mockReturnValue(NOW + 5_000)
    const first = player.restoreFromSave(save, corruptAuthority())
    expect(first.elapsedSeconds).toBe(0)

    // Fresh manager body with the degrade stamping a different T2: the
    // outcome is the same - the >60s settle never fires.
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')
    spy.mockReturnValue(NOW + 9_999)
    manager.saveOps.restoreFromSave(save, corruptAuthority())
    expect(settleSpy).not.toHaveBeenCalled()
  })
})

// ----------------------------------------------------------------------------
// (c) R25-INT-01: consistent +Δ-epoch payload -> verbatim restore -> the
//     next honest write self-rejects
// ----------------------------------------------------------------------------
describe('seam (c) - payload-seeded future stamps self-brick the next write', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('consistent +Δ stamps pass admission, restore verbatim, and the next buildGameSave fails validation', () => {
    const DELTA = HOUR_MS
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)

    // Every persisted stamp shifted +Δ TOGETHER: internally consistent
    // epoch, every admission pin satisfied (startedAtMs <= lastSavedAt,
    // cooldownUntil <= lastSavedAt + 300s, all bounded).
    const save = makeSave({
      lastSavedAt: NOW + DELTA,
      autoWorkerCapacity: 3,
      productionSites: [
        {
          siteId: 'thanh_van_lam',
          level: 1,
          autoRestart: true,
          workerCycles: [
            {
              cycleId: 'r25_wc1',
              siteId: 'thanh_van_lam',
              collectionRealmId: 'mortal',
              siteLevelAtStart: 1,
              rewardTableVersion: 1,
              rollSeed: 12345,
              startedAtMs: NOW + DELTA - MORTAL_CYCLE_MS,
              completesAtMs: NOW + DELTA,
            },
          ],
        },
      ],
      tribulation: { cooldownUntil: NOW + DELTA + 120_000 },
      quests: {
        active: [],
        completedOnceIds: [],
        lastDailyResetAtMs: NOW + DELTA - 60_000,
        questFlags: [],
      },
    })
    const admission = validateGameSaveShape(save)
    expect(admission.ok).toBe(true)

    const result = restoreGameSession(player, manager, save)
    expect(result.status).toBe('ok')

    // Deadline channels restore VERBATIM at +Δ - no reader-side clamp.
    const site = manager.productionSystem
      .getAllStates()
      .find((state) => state.siteId === 'thanh_van_lam')
    expect(site?.workerCycles?.[0]?.startedAtMs).toBe(NOW + DELTA - MORTAL_CYCLE_MS)
    expect(site?.workerCycles?.[0]?.completesAtMs).toBe(NOW + DELTA)
    expect(manager.tribulationDirector.serializeRuntime()?.cooldownUntil).toBe(
      NOW + DELTA + 120_000,
    )

    // Healed sibling: the same +Δ shift on lastDailyResetAtMs clamps to
    // now at restore - this stamp would NOT brick the next write. The
    // asymmetry (healed vs verbatim) is the coverage gap.
    expect(manager.questManager.getState().lastDailyResetAtMs).toBeLessThanOrEqual(NOW)

    // Next honest write: lastSavedAt = Date.now() = NOW < the
    // verbatim-restored head stamps -> the reader pins reject the
    // app-written payload.
    const repacked = buildGameSave(player.$state, manager)
    const verdict = validateGameSaveShape(repacked)
    expect(verdict.ok).toBe(false)
    const paths = verdict.ok ? [] : verdict.issues.map((issue) => issue.path)
    expect(paths.some((path) => path.includes('startedAtMs'))).toBe(true)
    expect(paths.some((path) => path.includes('tribulation'))).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (d) honored forward-skewed authority: full paid span vs clamped stamps
// ----------------------------------------------------------------------------
describe('seam (d) - forward-skew settle split: paid span wide, stamps clamped', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('player pays the full approved span; seeded lane heads clamp at now and collect at real wall time', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    const save = makeSave({
      lastSavedAt: NOW - 600_000,
      autoWorkerCapacity: 3,
      productionSites: [{ siteId: 'thanh_van_lam', level: 1, autoRestart: true }],
    })
    const authority: RestoreTimeAuthority = {
      kind: 'cold-boot',
      sinceMs: NOW - 600_000,
      untilMs: NOW + 30_000, // honored (in-domain) but 30s in the future
    }

    const result = restoreGameSession(player, manager, save, authority)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      // The approved window is paid in FULL - the Date.now() clamp only
      // bounds persisted stamps, not the granted span.
      expect(result.offline.elapsedSeconds).toBe(630)
    }

    // Seeded lane heads use min(nowMs, settleNowMs) = NOW: no stamp
    // lands past the real wall clock.
    const site = manager.productionSystem
      .getAllStates()
      .find((state) => state.siteId === 'thanh_van_lam')
    const heads = site?.workerCycles ?? []
    expect(heads.length).toBeGreaterThan(0)
    for (const cycle of heads) {
      expect(cycle.startedAtMs).toBeLessThanOrEqual(NOW)
    }
    // Some dues are DEFERRED past now (the settled window stopped at
    // real time even though the authority approved 30s more).
    const pending = heads.filter((cycle) => cycle.completesAtMs > NOW)
    expect(pending.length).toBeGreaterThan(0)

    // The deferred dues still collect - at real wall time, not the
    // approved span. Mortal cycle = 100s: one extra tick at NOW+101s
    // turns the pending heads over.
    const beforeIds = heads.map((cycle) => cycle.cycleId)
    manager.productionSystem.tickWorkers(
      NOW + 101_000,
      manager.materialBag,
      manager.materialRegistry,
      'mortal',
      3,
      undefined,
      () => 0.5,
    )
    const afterIds = manager.productionSystem
      .getAllStates()
      .find((state) => state.siteId === 'thanh_van_lam')
      ?.workerCycles?.map((cycle) => cycle.cycleId) ?? []
    expect(afterIds).not.toEqual(beforeIds)
  })
})

// ----------------------------------------------------------------------------
// (e) EarlyGameSession - restoreCheckpoint supplies no authority
// ----------------------------------------------------------------------------
describe('seam (e) - EarlyGameSession absent-authority path', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('restoreCheckpoint settles the legacy client window on both sides (no authority)', () => {
    const player = usePlayerStore()
    const session = new EarlyGameSession({
      seed: 11,
      profile: { name: 'r25_probe', talentIds: ['hap_linh'] },
    })
    const settleSpy = vi.spyOn(
      session.gameManager.turnBattleOps.autoFarmOps,
      'settleAutoFarmOffline',
    )

    const save = makeSave({ lastSavedAt: NOW - 7_200_000 })
    const result = session.restoreCheckpoint(save, player)

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      // No authority -> the client window applies unchanged: the
      // sanitize/degrade batch does not alter this path.
      expect(result.offline.elapsedSeconds).toBe(7_200)
    }
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 7_200)
  })
})

// ----------------------------------------------------------------------------
// (f) QUEST_LIST_CAP vs honest quest flows
// ----------------------------------------------------------------------------
describe('seam (f) - QUEST_LIST_CAP vs the honest roster', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('honest state over the full authored roster validates far under the cap', () => {
    const manager = registeredManager()
    const qm = manager.questManager
    // Saturate every honest channel the flows can write: activate the
    // whole roster, complete everything once, stamp flags.
    for (const quest of QUESTS) {
      qm.ensureActive(quest)
      qm.markCompletedOnce(quest.id)
      qm.markQuestFlag(`flag_${quest.id}`)
    }
    const state = qm.getState()
    expect(QUESTS.length).toBeLessThan(1_024)
    expect(state.active.length).toBeLessThanOrEqual(QUESTS.length)
    expect(state.completedOnceIds.length).toBeLessThanOrEqual(QUESTS.length)
    expect(state.questFlags?.length ?? 0).toBeLessThanOrEqual(QUESTS.length)

    const save = makeSave({ quests: structuredClone(state) as GameSave['quests'] })
    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('crafted over-cap lists reject on all three slices', () => {
    const active1025 = Array.from({ length: 1_025 }, (_, i) => ({
      questId: `crafted_${i}`,
      progress: 0,
      claimed: false,
    }))
    const strings1025 = Array.from({ length: 1_025 }, (_, i) => `crafted_${i}`)

    for (const quests of [
      { active: active1025, completedOnceIds: [], lastDailyResetAtMs: 0, questFlags: [] },
      { active: [], completedOnceIds: strings1025, lastDailyResetAtMs: 0, questFlags: [] },
      { active: [], completedOnceIds: [], lastDailyResetAtMs: 0, questFlags: strings1025 },
    ]) {
      const save = makeSave({ quests: quests as GameSave['quests'] })
      expect(validateGameSaveShape(save).ok).toBe(false)
    }
  })
})

// ----------------------------------------------------------------------------
// (g) payload-identity caches post-fix: deny-only, both sides
// ----------------------------------------------------------------------------
describe('seam (g) - identity caches keep the deny-only property post-fix', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('manager-side: a corrupt settle commits the payload hash; an honest replay is skipped as duplicate', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({ lastSavedAt: NOW - 600_000 })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    manager.saveOps.restoreFromSave(save, corruptAuthority())
    expect(settleSpy).not.toHaveBeenCalled()

    // Same payload under an honored 600s window: the identity cache
    // holds - the denied settle persists, no >60s settle fires on retry.
    manager.saveOps.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW - 600_000,
      untilMs: NOW,
    })
    expect(settleSpy).not.toHaveBeenCalled()
  })

  it('player-side honest-then-corrupt: the replay returns the first-authority result without re-granting', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 600_000 })

    const first = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW - 600_000,
      untilMs: NOW,
    })
    expect(first.elapsedSeconds).toBe(600)
    const cultivationAfterFirst = player.cultivation
    expect(cultivationAfterFirst).toBe(600) // payload 0 + 600s * 1/s

    // Retry the same payload under a corrupt authority: the cache
    // replays the honored result (bounded by the first approval) and
    // does NOT re-grant.
    const retry = player.restoreFromSave(save, corruptAuthority())
    expect(retry.elapsedSeconds).toBe(600)
    expect(player.cultivation).toBe(cultivationAfterFirst)
  })

  it('split-brain asymmetry post-fix stays deny-bounded: cached deny vs live honest settle', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({ lastSavedAt: NOW - 600_000 })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    // Player committed under a corrupt authority; the manager half
    // "threw" before settling (simulated mid-restore fault).
    const denied = player.restoreFromSave(save, corruptAuthority())
    expect(denied.elapsedSeconds).toBe(0)

    // The retry settles the manager half live under a REAL honored
    // window while the player replays its cached deny.
    manager.saveOps.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW - 200_000,
      untilMs: NOW,
    })
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 200)
    const replay = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW - 200_000,
      untilMs: NOW,
    })
    expect(replay.elapsedSeconds).toBe(0)
    // Each side's outcome is legitimate for SOME authority - the cache
    // never exceeds the union of approved windows (deny direction only).
  })
})

// ----------------------------------------------------------------------------
// round-trip: a degraded restore leaves no poison in the next save
// ----------------------------------------------------------------------------
describe('round-trip - degrade -> save -> honest re-restore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a zero-accrual degraded restore repackages clean and a fresh restore under an honored authority settles normally', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    const save = makeSave({ lastSavedAt: NOW - 600_000 })

    const denied = restoreGameSession(player, manager, save, corruptAuthority())
    expect(denied.status).toBe('ok')
    if (denied.status === 'ok') {
      expect(denied.offline.elapsedSeconds).toBe(0)
    }

    // The written-back save carries live stamps (Date.now() epoch) -
    // admission stays green.
    const repacked = buildGameSave(player.$state, manager)
    expect(validateGameSaveShape(repacked).ok).toBe(true)

    // A later restore of an honest save under a real authority pays the
    // real window - the degrade leaves no residue on either side. A
    // fresh pinia = a fresh store: the identity cache lives on the
    // player instance and excludes lastSavedAt by design.
    setActivePinia(createPinia())
    const player2 = usePlayerStore()
    const manager2 = registeredManager()
    const honest = makeSave({ lastSavedAt: NOW - 300_000 })
    const settled = restoreGameSession(player2, manager2, honest, {
      kind: 'cold-boot',
      sinceMs: NOW - 300_000,
      untilMs: NOW,
    })
    expect(settled.status).toBe('ok')
    if (settled.status === 'ok') {
      expect(settled.offline.elapsedSeconds).toBe(300)
    }
  })
})
