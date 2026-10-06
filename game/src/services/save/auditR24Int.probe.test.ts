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
// Seam (a): the SAME authority object flows to player.restoreFromSave
//           and gameManager.saveOps.restoreFromSave - both must sanitize
//           identically, and no other consumer may read raw stamps.
// Seam (b): the client-clock fallback's capped-vs-uncapped split must
//           mirror what an honored authority on the same payload would
//           produce - the raw window resolves uncapped and each settle
//           channel self-caps downstream.
// Seam (d): round-trip - after a sanitized restore, buildGameSave must
//           not persist stamps the validator rejects.
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

  it('out-of-domain cold-boot untilMs: player pays the client window AND the manager settles the same client window', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({ lastSavedAt: NOW - 600_000 })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')
    const alchemySpy = vi.spyOn(manager.alchemySystem, 'settleOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 600_000,
      untilMs: TWO_POW_52, // |stamp| >= 2^52 -> whole authority drops
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    // Player side: client-clock fallback paid the honest 600s, not the
    // absurd until-since span and not the 24h-cap collapse.
    expect(result.offline.elapsedSeconds).toBe(600)
    expect(result.offline.cultivation).toBe(600)
    // Manager side resolved the SAME window (raw, uncapped): the settle
    // bound sits at lastSavedAt + 600s = client now, not at untilMs.
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 600)
    expect(alchemySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      NOW,
      0,
      expect.any(Number),
      expect.any(Function),
    )
  })

  it('out-of-domain cold-boot sinceMs (untilMs honest): the whole authority still drops - no partial-stamp salvage', () => {
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
    expect(result.offline.elapsedSeconds).toBe(600)
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 600)
  })

  it('corrupt live-replacement nowMs: BOTH consumers flip to the client window (r23 kind-blind fallback pin)', () => {
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
    // Deliberate per the r23 pin (player.restoreFromSave.test.ts): a
    // corrupt live-replacement pays the client window rather than the
    // honest zero-accrual semantics of its kind - symmetric on both
    // consumers, bounded by the 24h player cap + per-channel caps.
    expect(result.offline.elapsedSeconds).toBe(600)
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 600)
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
      untilMs: TWO_POW_52, // drops -> client-clock fallback pays 600s
    })
    expect(first.elapsedSeconds).toBe(600)

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
    expect(again.elapsedSeconds).toBe(600) // cached first-call window
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

  it('sanitized fallback keeps the capped-vs-uncapped split: player accrual caps at 24h while the manager resolves the raw 48h window and channels self-cap', () => {
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
      untilMs: TWO_POW_52, // drops -> fallback
    })

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)
    // Player side: default-capped 24h accrual (86400s of 172800s).
    expect(result.offline.elapsedSeconds).toBe(86_400)
    // Manager side: the raw window resolves UNCAPPED (172800s) exactly
    // as an honored cold-boot on the same payload would - the window
    // bounds are the per-channel caps downstream, not this argument.
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 172_800)
    // settleNowMs = lastSavedAt + elapsed = NOW (client epoch);
    // offlineSinceMs = min(lastSavedAt, now - elapsed) = lastSavedAt.
    expect(decomposeSpy).toHaveBeenCalledWith(NOW, NOW - 48 * HOUR_MS)
    expect(alchemySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      NOW,
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
      untilMs: TWO_POW_52, // drops -> fallback
    })
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error(result.message)

    const repackaged = buildGameSave(player.$state, manager)
    // Seeded lane heads anchor at <= settleNowMs = Date.now() = the new
    // save's own lastSavedAt, so the startedAtMs <= lastSavedAt pin
    // holds by construction.
    const heads = (repackaged.productionSites ?? []).flatMap(
      (site) => site.workerCycles ?? [],
    )
    expect(heads.length).toBeGreaterThan(0)
    for (const cycle of heads) {
      expect(cycle.startedAtMs).toBeLessThanOrEqual(NOW)
      expect(Math.abs(cycle.startedAtMs)).toBeLessThan(TWO_POW_52)
      expect(Math.abs(cycle.completesAtMs)).toBeLessThan(TWO_POW_52)
    }
    const shape = validateGameSaveShape(repackaged)
    expect(shape.ok).toBe(true)
  })

  it('RESIDUAL (r19 carried observation): an honored in-domain authority past Date.now() mints seeded lane stamps > lastSavedAt - the save then fails its own admission pin', () => {
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

    const repackaged = buildGameSave(player.$state, manager)
    const heads = (repackaged.productionSites ?? []).flatMap(
      (site) => site.workerCycles ?? [],
    )
    expect(heads.length).toBeGreaterThan(0)
    expect(heads.some((cycle) => cycle.startedAtMs > NOW)).toBe(true)

    const shape = validateGameSaveShape(repackaged)
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some((issue) => issue.path.includes('workerCycles')),
    ).toBe(true)
  })

  it('RESIDUAL (extreme): an honored in-domain absurd untilMs settles lanes at the 2^52 edge - the next save rejects', () => {
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
    // Seeded heads persist server-epoch stamps near the domain edge.
    expect(heads.some((cycle) => cycle.startedAtMs > NOW)).toBe(true)

    const shape = validateGameSaveShape(repackaged)
    expect(shape.ok).toBe(false)
  })
})

describe('unit pins - sanitizeRestoreAuthority contract', () => {
  it('undefined passes through; in-domain stamps survive verbatim; any out-of-domain stamp drops the whole authority', () => {
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
    // member discards the honest siblings too.
    expect(
      sanitizeRestoreAuthority({
        kind: 'cold-boot',
        sinceMs: Number.NaN,
        untilMs: NOW,
      }),
    ).toBeUndefined()
    expect(
      sanitizeRestoreAuthority({
        kind: 'cold-boot',
        sinceMs: NOW,
        untilMs: Number.NEGATIVE_INFINITY,
      }),
    ).toBeUndefined()
    expect(
      sanitizeRestoreAuthority({
        kind: 'live-replacement',
        nowMs: TWO_POW_52,
      }),
    ).toBeUndefined()
    expect(
      sanitizeRestoreAuthority({
        kind: 'live-replacement',
        nowMs: -TWO_POW_52,
      }),
    ).toBeUndefined()
  })
})
