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
    // The settle clock is the approved window end (lastSavedAt+200s),
    // not the machine now.
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 200, NOW - 700_000)
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
    // paused window. Anchor = the snapshot end (lastSavedAt+0).
    expect(settleSpy).toHaveBeenCalledWith(expect.objectContaining({}), 0, NOW - 900_000)
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
