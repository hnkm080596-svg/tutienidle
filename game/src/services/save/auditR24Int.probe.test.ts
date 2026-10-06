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

// ============================================================================
// QA probe - fixpoint r24 INT wave (audit of commit f50fdaf9, the r23
// batch: sanitizeRestoreAuthority drops out-of-domain authority stamps
// (|x| >= 2^52 or non-finite) to the client-clock fallback inside BOTH
// restoreFromSave bodies; insight acc non-finite reset; comment fixes).
//
// r24 adjudication updates the contract under probe:
//  * r24-AUT-1/2 + R24-COR-1: a PRESENT-but-corrupt authority degrades
//    to ZERO-ACCRUAL live-replacement anchored at Date.now() - never to
//    `undefined` (the client window can exceed the approved span).
//  * R24-INT-01: the settle cursor is clamped at Date.now() too, so a
//    forward-skewed authority can no longer persist stamps past the
//    next save's lastSavedAt (the self-brick residual).
//
// Seam (a): the SAME authority object flows to player.restoreFromSave
//           and gameManager.saveOps.restoreFromSave - both must sanitize
//           identically, and no other consumer may read raw stamps.
// Seam (b): a degraded (zero-accrual) authority fires no >60s settle
//           at all; the unconditional alchemy settle sees the payload
//           marker as its cursor.
// Seam (d): round-trip - after a sanitized or forward-skewed restore,
//           buildGameSave must not persist stamps the validator rejects.
// ============================================================================

const NOW = 1_725_160_000_000
const TWO_POW_52 = 2 ** 52
const HOUR_MS = 3_600_000

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
  // buildGameSave stamps lastSavedAt = Date.now(); the test controls the
  // payload's persisted timestamp directly.
  save.player.lastSavedAt = overrides.lastSavedAt ?? NOW
  if (overrides.productionSites !== undefined) {
    save.productionSites = overrides.productionSites
  }
  if (overrides.autoWorkerCapacity !== undefined && overrides.autoWorkerCapacity > 0) {
    // F-W-16: a non-zero persisted capacity requires the chi_hien_quan
    // building witness in the same payload.
    save.buildings = [
      {
        instanceId: 'r24_chq',
        buildingId: 'chi_hien_quan',
        level: 1,
        lastCollectedAt: 0,
      },
    ]
  }
  return save
}

describe('seam (a) - both restore bodies sanitize the same authority identically', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('out-of-domain cold-boot untilMs: BOTH consumers deny accrual symmetrically (fixed)', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({ lastSavedAt: NOW - 600_000 })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')
    const alchemySpy = vi.spyOn(manager.alchemySystem, 'settleOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 600_000,
      untilMs: TWO_POW_52, // corrupt -> degrades to zero-accrual live-replacement
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    // Player side: ZERO accrual - the editable client window is never
    // consulted (600s denied, not the absurd until-since span either).
    expect(result.offline.elapsedSeconds).toBe(0)
    expect(result.offline.cultivation).toBe(0)
    // Manager side: elapsed 0 -> the >60s settle gate never fires.
    expect(settleSpy).not.toHaveBeenCalled()
    // The unconditional alchemy settle sees the payload marker as its
    // cursor (min(lastSavedAt + 0, degraded-nowMs, Date.now())).
    expect(alchemySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      NOW - 600_000,
      0,
      expect.any(Number),
      expect.any(Function),
    )
  })

  it('out-of-domain cold-boot sinceMs (untilMs honest): no partial-stamp salvage - accrual denied', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({ lastSavedAt: NOW - 600_000 })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: -TWO_POW_52, // corrupt start invalidates the honest end too
      untilMs: NOW,
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    expect(result.offline.elapsedSeconds).toBe(0)
    expect(settleSpy).not.toHaveBeenCalled()
  })

  it('corrupt live-replacement nowMs: zero-accrual contract survives on BOTH consumers (fixed)', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({ lastSavedAt: NOW - 600_000 })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'live-replacement',
      nowMs: Number.POSITIVE_INFINITY,
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    // r24-AUT-2 fixed: a corrupt live-replacement keeps paying ZERO -
    // there is no mint path left on the channel.
    expect(result.offline.elapsedSeconds).toBe(0)
    expect(settleSpy).not.toHaveBeenCalled()
  })

  it('boundary: untilMs just inside the domain is still honored - the absurd raw window reaches settle (channels self-cap)', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({ lastSavedAt: NOW - 600_000 })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 600_000,
      untilMs: TWO_POW_52 - 1, // in-domain -> honored
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    // The player's own accrual still caps at the default 24h offline
    // bound, while the manager resolves the RAW honored span (about
    // 4.5e12 seconds) - identical to what any in-domain authority
    // resolves; the settle-side cap is per-channel, not here.
    expect(result.offline.elapsedSeconds).toBe(86_400)
    const elapsedArg = settleSpy.mock.calls[0]?.[1] as number
    expect(elapsedArg).toBeCloseTo((TWO_POW_52 - 1 - (NOW - 600_000)) / 1000, 3)
    expect(elapsedArg).toBeGreaterThan(4e12)
  })

  it('payload-identity caches are authority-agnostic: a split retry settles each side under a different authority', () => {
    // Documents the pre-existing asymmetry behind the identity guards:
    // lastRestoredPayloads (player.ts) and lastAppliedPayloadHash
    // (GameManagerSaveRestore) key on payload identity only. A retry
    // after a mid-restore throw - player committed, manager not - with
    // a FRESH authority (new serverNow) returns the player-side cached
    // window while the manager settles the new window.
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 600_000 })

    const first = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW - 600_000,
      untilMs: TWO_POW_52, // corrupt -> zero-accrual degrade pays 0
    })
    expect(first.elapsedSeconds).toBe(0)

    // The manager half never committed (simulated mid-restore throw):
    // a retry under an honored authority settles 200s while the player
    // side replays the cached 600s fallback result.
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')
    manager.saveOps.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW - 200_000,
      untilMs: NOW,
    })
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 200)

    const again = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: NOW - 200_000,
      untilMs: NOW,
    })
    expect(again.elapsedSeconds).toBe(0) // cached first-call (denied) window
  })
})

describe('seam (b) - fallback window vs calculateOfflineTime cap split', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('degraded zero-accrual authority: no settle gate fires and the alchemy cursor is the payload marker', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    // 48h stale save - beyond the default 24h offline cap.
    const save = makeSave({ lastSavedAt: NOW - 48 * HOUR_MS })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')
    const decomposeSpy = vi.spyOn(manager.decomposeSystem, 'settleOffline')
    const alchemySpy = vi.spyOn(manager.alchemySystem, 'settleOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 48 * HOUR_MS,
      untilMs: TWO_POW_52, // corrupt -> zero-accrual degrade
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    // Deny: zero accrual on a corrupt authority - no channel settle.
    expect(result.offline.elapsedSeconds).toBe(0)
    expect(settleSpy).not.toHaveBeenCalled()
    expect(decomposeSpy).not.toHaveBeenCalled()
    // The unconditional alchemy pass anchors at the payload marker
    // (min(lastSavedAt + 0, NOW, NOW)) - deferred dues keep their times.
    expect(alchemySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      NOW - 48 * HOUR_MS,
      0,
      expect.any(Number),
      expect.any(Function),
    )
  })

  it('the fallback window is never wider than an honored authority on the same payload (no sanitized-fallback over-mint)', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({ lastSavedAt: NOW - 48 * HOUR_MS })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')

    // Honored cold-boot spanning the full 48h: identical raw window.
    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 48 * HOUR_MS,
      untilMs: NOW,
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    expect(result.offline.elapsedSeconds).toBe(86_400)
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 172_800)
  })
})

describe('seam (d) - round-trip after a sanitized restore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fallback restore persists only client-epoch stamps: the next buildGameSave re-validates cleanly', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({
      lastSavedAt: NOW - 48 * HOUR_MS,
      autoWorkerCapacity: 3,
      // An auto-restart site exercises the lane-seeding path under the
      // fallback settle (settleNowMs = client now).
      productionSites: [
        { siteId: 'thanh_van_lam', level: 1, autoRestart: true },
      ],
    })
    // The input payload itself is a legal save.
    expect(validateGameSaveShape(save).ok).toBe(true)

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 48 * HOUR_MS,
      untilMs: TWO_POW_52, // corrupt -> zero-accrual degrade (no seeding runs)
    })
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)

    const repackaged = buildGameSave(player.$state, manager)
    // Zero accrual => the >60s seeding path never ran, so any persisted
    // heads are input-carried only; whatever exists must still satisfy
    // the startedAtMs <= lastSavedAt pin.
    const heads = (repackaged.productionSites ?? []).flatMap(
      (site) => site.workerCycles ?? [],
    )
    for (const cycle of heads) {
      expect(cycle.startedAtMs).toBeLessThanOrEqual(NOW)
      expect(Math.abs(cycle.startedAtMs)).toBeLessThan(TWO_POW_52)
      expect(Math.abs(cycle.completesAtMs)).toBeLessThan(TWO_POW_52)
    }
    const shape = validateGameSaveShape(repackaged)
    expect(shape.ok).toBe(true)
  })

  it('R24-INT-01 fixed: a forward-skewed honored authority can no longer seed lane stamps past lastSavedAt - the save re-validates', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    // Phase-aligned so a cycle due lands strictly inside (NOW, untilMs]:
    // with a 300s cycle and emptyLaneStartMs = lastSavedAt, dues land at
    // lastSavedAt + k*300s -> NOW+10s is a due, so the surviving pending
    // head starts at NOW+10s > the next save's lastSavedAt (= NOW).
    const save = makeSave({
      lastSavedAt: NOW - 890_000,
      autoWorkerCapacity: 3,
      productionSites: [
        { siteId: 'thanh_van_lam', level: 1, autoRestart: true },
      ],
    })
    expect(validateGameSaveShape(save).ok).toBe(true)

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 890_000,
      untilMs: NOW + 30_000, // honest 30s server clock skew - honored
    })
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)

    // Fixed: the settle cursor clamps at Date.now(), so dues in the
    // 30s skew window defer to live ticks and every seeded head stays
    // inside the client epoch -> the next save validates.
    const repackaged = buildGameSave(player.$state, manager)
    const heads = (repackaged.productionSites ?? []).flatMap(
      (site) => site.workerCycles ?? [],
    )
    expect(heads.length).toBeGreaterThan(0)
    expect(heads.every((cycle) => cycle.startedAtMs <= NOW)).toBe(true)

    const shape = validateGameSaveShape(repackaged)
    expect(shape.ok).toBe(true)
  })

  it('R24-INT-01 fixed (extreme): an honored in-domain absurd untilMs clamps the settle cursor at client now - the next save validates', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({
      lastSavedAt: NOW - 600_000,
      autoWorkerCapacity: 3,
      productionSites: [
        { siteId: 'thanh_van_lam', level: 1, autoRestart: true },
      ],
    })
    expect(validateGameSaveShape(save).ok).toBe(true)

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 600_000,
      untilMs: TWO_POW_52 - 1, // in-domain -> honored -> settleNowMs ~4.5e15
    })
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)

    const repackaged = buildGameSave(player.$state, manager)
    const heads = (repackaged.productionSites ?? []).flatMap(
      (site) => site.workerCycles ?? [],
    )
    expect(heads.length).toBeGreaterThan(0)
    // Seeded heads stay inside the client epoch - no server-epoch
    // stamps near the domain edge leak into the persisted save.
    expect(heads.every((cycle) => cycle.startedAtMs <= NOW)).toBe(true)

    const shape = validateGameSaveShape(repackaged)
    expect(shape.ok).toBe(true)
  })
})

describe('unit pins - sanitizeRestoreAuthority contract', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('undefined passes through; in-domain stamps survive verbatim; any out-of-domain stamp degrades the authority to zero-accrual', () => {
    expect(sanitizeRestoreAuthority(undefined)).toBeUndefined()
    expect(
      sanitizeRestoreAuthority({
        kind: 'cold-boot',
        sinceMs: NOW - 1000,
        untilMs: NOW,
      }),
    ).toEqual({ kind: 'cold-boot', sinceMs: NOW - 1000, untilMs: NOW })
    expect(
      sanitizeRestoreAuthority({ kind: 'live-replacement', nowMs: NOW }),
    ).toEqual({ kind: 'live-replacement', nowMs: NOW })

    // Every stamp in the union is checked - a single out-of-domain
    // member degrades the whole authority to zero-accrual
    // live-replacement at the local clock (never `undefined`).
    expect(
      sanitizeRestoreAuthority({
        kind: 'cold-boot',
        sinceMs: Number.NaN,
        untilMs: NOW,
      }),
    ).toEqual({ kind: 'live-replacement', nowMs: NOW })
    expect(
      sanitizeRestoreAuthority({
        kind: 'cold-boot',
        sinceMs: NOW,
        untilMs: Number.NEGATIVE_INFINITY,
      }),
    ).toEqual({ kind: 'live-replacement', nowMs: NOW })
    expect(
      sanitizeRestoreAuthority({
        kind: 'live-replacement',
        nowMs: TWO_POW_52,
      }),
    ).toEqual({ kind: 'live-replacement', nowMs: NOW })
    expect(
      sanitizeRestoreAuthority({
        kind: 'live-replacement',
        nowMs: -TWO_POW_52,
      }),
    ).toEqual({ kind: 'live-replacement', nowMs: NOW })
  })
})
