// B1-D (beta-final PR5) - the server-authorized time window. Under remote
// authority neither the client clock nor the payload's editable
// lastSavedAt may bound offline accrual: 'cold-boot' accrues exactly
// [cutoff, serverNow] positioned inside the payload's own epoch,
// 'live-replacement' accrues ZERO and only re-anchors live clocks.
// R12: a pending checkpoint retried at reopen keeps its historical
// cutoff - the authorized window must not collapse to serverNow.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { usePlayerStore } from '../../stores/player'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave, restoreGameSession, type GameSave } from './SaveSystem'
import type { Stage } from '../../core/stage/Stage'
import { buildings } from '../../data/building/buildings'
import { settleProductionOffline } from '../../core/production/ProductionOffline'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import type { ProductionSiteState } from '../../core/production/ProductionTypes'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import type { RestoreTimeAuthority } from './saveTypes'

const NOW = 1_725_160_000_000

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  return manager
}

function makeSave(overrides: { lastSavedAt?: number; autoFarmStage?: { stageId: string; lastCheckedMs: number } | null } = {}): GameSave {
  const manager = registeredManager()
  const player = createDefaultPlayer()
  primeMortalCreationPick(player, manager.skillManager)
  player.cultivation = 0
  player.cultivationPerSecond = 1
  if (overrides.autoFarmStage !== undefined) {
    player.autoFarmStage = overrides.autoFarmStage
  }
  const save = buildGameSave(player, manager)
  // buildGameSave stamps lastSavedAt = Date.now(); the test controls the
  // payload's persisted timestamp directly.
  save.player.lastSavedAt = overrides.lastSavedAt ?? NOW
  return save
}

describe('RestoreTimeAuthority — cold-boot window (B1-D)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accrues the authorized window, not Date.now()-lastSavedAt: the server bound wins over a stale payload clock', () => {
    const player = usePlayerStore()
    // Payload claims a 300s-old save; the server authorizes only 100s.
    const save = makeSave({ lastSavedAt: NOW - 300_000 })
    const authority: RestoreTimeAuthority = {
      kind: 'cold-boot',
      sinceMs: NOW - 100_000,
      untilMs: NOW,
    }

    const result = player.restoreFromSave(save, authority)

    expect(result.elapsedSeconds).toBe(100)
    // cultivationPerSecond = 1 with no timed buffs -> 100 units.
    expect(result.cultivation).toBe(100)
  })

  it('R12: a pending checkpoint retried at reopen accrues from ITS server cutoff, not from lastSavedAt and not to zero', () => {
    const player = usePlayerStore()
    // The pending checkpoint committed 120s ago (progression_cutoff_at);
    // the payload's own lastSavedAt is older (the write never ACKed).
    const save = makeSave({ lastSavedAt: NOW - 600_000 })
    const authority: RestoreTimeAuthority = {
      kind: 'cold-boot',
      sinceMs: NOW - 120_000, // historical pending checkpoint cutoff
      untilMs: NOW, // serverNowUtc at reopen
    }

    const result = player.restoreFromSave(save, authority)

    // The retry neither erases elapsed reward (would be 0 under a
    // now-bound window) nor double-counts the checkpointed span (600s
    // under a naive lastSavedAt window).
    expect(result.elapsedSeconds).toBe(120)
    expect(result.cultivation).toBe(120)
  })

  it('live-replacement accrues zero regardless of how old the payload claims to be', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 10_000_000 })

    const result = player.restoreFromSave(save, { kind: 'live-replacement', nowMs: NOW })

    expect(result.elapsedSeconds).toBe(0)
    expect(result.cultivation).toBe(0)
  })

  it('undefined authority keeps the legacy client-clock semantics', () => {
    const player = usePlayerStore()
    const save = makeSave({ lastSavedAt: NOW - 42_000 })

    const result = player.restoreFromSave(save)

    expect(result.elapsedSeconds).toBe(42)
    expect(result.cultivation).toBe(42)
  })
})

describe('RestoreTimeAuthority — owner settle behavior through restoreGameSession (B1-D)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cold-boot >60s: auto-farm settles exactly the authorized window, no more', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)

    const save = makeSave({ lastSavedAt: NOW - 900_000 })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')
    const alchemySpy = vi.spyOn(manager.alchemySystem, 'settleOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 200_000,
      untilMs: NOW,
    })

    expect(result.status).toBe('ok')
    // 200s authorized - NOT the 900s a lastSavedAt read would mint.
    // r15-COR-E: the settle's farm anchor stays in the lastCheckedMs
    // field's own epoch (Date.now) - the authorized width is carried
    // by elapsedOfflineSeconds alone.
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 200)
    // The alchemy settle bound sits inside the payload's own epoch:
    // lastSavedAt + elapsed, identical to legacy positioning.
    expect(alchemySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      NOW - 900_000 + 200_000,
      0,
      expect.any(Number),
      expect.any(Function),
    )
  })

  it('cold-boot: the farm anchor rewrites in the field epoch, not the settle window end (r15-COR-E pin)', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)

    // The farm must survive restore's eligibility re-check: real stage
    // registration + perfect-clear witness, same contract as runtime.
    const farmStage: Stage = {
      id: 'farm_stage',
      name: 'farm_stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: 'stage_probe', weight: 1 }],
      totalEnemyCount: 1,
      waves: [1],
      spawnIntervalSeconds: 0,
    }
    manager.catalogOps.registerStages([farmStage])
    const save = makeSave({
      lastSavedAt: NOW - 900_000,
      autoFarmStage: { stageId: 'farm_stage', lastCheckedMs: NOW - 900_000 },
    })
    save.player.perfectClearStageIds = ['farm_stage']
    save.player.perfectClearSeconds = { farm_stage: 100 }

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 200_000,
      untilMs: NOW,
    })

    expect(result.status).toBe('ok')
    // 200s authorized -> 100 halved seconds -> one 100s cycle, rem 0.
    // The anchor must sit at restore-now (the Date.now epoch every
    // lastCheckedMs writer/reader shares), not at settleNowMs =
    // lastSavedAt + elapsed = NOW - 700s - the r13 stamp left the
    // unauthorized tail in the anchor for the next tick to mint.
    const anchor = player.autoFarmStage!.lastCheckedMs
    expect(anchor).toBeGreaterThanOrEqual(NOW - 1_000)
    expect(anchor).toBeLessThanOrEqual(NOW)
  })

  it('live-replacement with an armed farm re-anchors (settle(0)) without catch-up; decompose/alchemy stop at the snapshot', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)

    const save = makeSave({
      lastSavedAt: NOW - 900_000,
      autoFarmStage: { stageId: 'stage-live-replaced', lastCheckedMs: NOW - 900_000 },
    })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')
    const decomposeSpy = vi.spyOn(manager.decomposeSystem, 'settleOffline')
    const alchemySpy = vi.spyOn(manager.alchemySystem, 'settleOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'live-replacement',
      nowMs: NOW,
    })

    expect(result.status).toBe('ok')
    // Queue restored, zero-accrual settle: re-anchor, never catch up the
    // paused window (r15-COR-E: the anchor is client-epoch now).
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 0)
    expect(decomposeSpy).not.toHaveBeenCalled()
    // settleNowMs = lastSavedAt + 0 => jobs complete only at the snapshot.
    expect(alchemySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      NOW - 900_000,
      0,
      expect.any(Number),
      expect.any(Function),
    )
  })

  it('cold-boot with an honest fast client clock settles the full window (r14-COR-1 pin)', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)

    // Client clock 300s ahead of the server: lastSavedAt lands past
    // untilMs even though the save is honest. Pre-fix the settle
    // window collapsed to [until, until] -> production/decompose paid
    // 0 while auto-farm paid the same elapsed.
    const save = makeSave({ lastSavedAt: NOW + 300_000 })
    const productionSpy = vi.spyOn(manager.productionSystem, 'settleOffline')
    const decomposeSpy = vi.spyOn(manager.decomposeSystem, 'settleOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 200_000,
      untilMs: NOW,
    })

    expect(result.status).toBe('ok')
    // offlineSinceMs anchors at untilMs - elapsed = sinceMs; the end
    // still clamps at the approved untilMs - full authorized width.
    expect(productionSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      NOW,
      expect.objectContaining({ offlineSinceMs: NOW - 200_000 }),
    )
    expect(decomposeSpy).toHaveBeenCalledWith(NOW, NOW - 200_000)
  })

  it('cold-boot window under the 60s gate runs no production/auto-farm catch-up', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)

    const save = makeSave({ lastSavedAt: NOW - 900_000 })
    const settleSpy = vi.spyOn(manager.turnBattleOps.autoFarmOps, 'settleAutoFarmOffline')
    const decomposeSpy = vi.spyOn(manager.decomposeSystem, 'settleOffline')
    const productionSpy = vi.spyOn(manager.productionSystem, 'settleOffline')

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 30_000,
      untilMs: NOW,
    })

    expect(result.status).toBe('ok')
    expect(settleSpy).not.toHaveBeenCalled()
    expect(decomposeSpy).not.toHaveBeenCalled()
    expect(productionSpy).not.toHaveBeenCalled()
  })
})

describe('RestoreTimeAuthority — field-epoch stamps (r16)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cold-boot: newly granted buildings stamp lastCollectedAt in the field epoch (r16-INT-02 pin)', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.catalogOps.registerBuildings(buildings)
    manager.setActivePlayer(player.$state)
    const save = makeSave({ lastSavedAt: NOW - 100_000 })
    save.buildings = []

    // Server clock 10d BEHIND the device clock: a server-epoch grant
    // stamp accrues min(skew, 10h) the building never produced (~3300
    // spirit stones in the auditor repro).
    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 100_000,
      untilMs: NOW - 10 * 86_400_000,
    })

    expect(result.status).toBe('ok')
    const instance = manager.buildingManager.getAll()[0]!
    expect(manager.buildingOps.getBuildingStoredAmount(instance.instanceId)).toBe(0)
  })

  it('offline production settle writes spawned lane deadlines in the field epoch (r16-INT-03 pin)', () => {
    const states = new Map<string, ProductionSiteState>([
      ['s1', { siteId: 's1', level: 1, autoRestart: true, activeWorkerSlots: 0, workerCycles: [] }],
    ])
    const bag = new MaterialBag()
    const registry = new MaterialRegistry()
    // Server authority end sits 10d behind the device clock.
    const until = NOW - 10 * 86_400_000

    settleProductionOffline(
      {
        states,
        getSiteDefinition: () => ({ siteId: 's1' }) as never,
        grantCycleRewards: () => undefined,
      },
      bag,
      registry,
      'mortal',
      until,
      { workerCapacity: 1, offlineSinceMs: until - 50_000 },
    )

    // Mortal L1 cycle is ~100s, so the lane seeded at until-50s stays
    // pending 50s past the window end. Its settle-epoch stamp already
    // reads past-due against Date.now() - the online tick would have
    // paid it ~10d early. The field-epoch re-stamp keeps it ahead.
    const pending = states.get('s1')!.workerCycles!
    expect(pending.length).toBe(1)
    expect(pending[0]!.completesAtMs).toBeGreaterThan(NOW)
  })

  it('cold-boot: quest daily-reset marker clamps against the field clock (r16-INT-04 pin)', () => {
    const player = usePlayerStore()
    const manager = registeredManager()
    manager.setActivePlayer(player.$state)
    const save = makeSave({ lastSavedAt: NOW - 3_600_000 })
    save.quests = {
      active: [],
      completedOnceIds: [],
      lastDailyResetAtMs: NOW - 3_600_000,
    }

    const result = restoreGameSession(player, manager, save, {
      kind: 'cold-boot',
      sinceMs: NOW - 3_600_000,
      untilMs: NOW - 10 * 86_400_000,
    })

    expect(result.status).toBe('ok')
    // The honest same-day marker survives: a server-epoch clamp would
    // have dragged it 10d back, refiring today's daily reset (wiping
    // unclaimed progress and re-arming claimed dailies).
    expect(manager.questManager.getLastDailyResetAtMs()).toBe(NOW - 3_600_000)
  })
})
