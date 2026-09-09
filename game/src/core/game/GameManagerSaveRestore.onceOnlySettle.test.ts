// R10 (AR-12, S4) — offline settle must run exactly once per payload.
// GameManagerSaveRestore.restoreFromSave() gates production/decompose/
// auto-farm/alchemy offline settlement purely on wall-clock elapsed time
// since save.player.lastSavedAt (elapsedOfflineSeconds > 60) — it never
// checked whether THIS EXACT payload had already been settled. A repeated
// call with the identical save (boot retry, reload race — the same
// scenario S2/S3 close for the player store and bag replacement) would
// re-run the same offline settlement and grant the same rewards again.
import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import type { GameSave } from '../../services/save/SaveSystem'

function baseSave(overrides: Partial<GameSave> = {}): GameSave {
  const player = createDefaultPlayer()

  return {
    version: CURRENT_SAVE_VERSION,
    // Far enough in the past to clear the >60s offline-settle gate.
    player: { ...player, lastSavedAt: Date.now() - 10_000_000 },
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
    productionSites: [],
    ...overrides,
  }
}

describe('GameManagerSaveRestore — once-only offline settle (R10, S4)', () => {
  it('restoring the identical payload twice settles auto-farm offline exactly once', () => {
    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    const settleSpy = vi.spyOn(manager, 'settleAutoFarmOffline')

    const save = baseSave({ player: { ...player, lastSavedAt: Date.now() - 10_000_000 } })

    manager.restoreFromSave(save)
    manager.restoreFromSave(save)

    expect(settleSpy).toHaveBeenCalledTimes(1)
  })

  it('restoring a genuinely different payload after the first still settles (not stuck skipping forever)', () => {
    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    const settleSpy = vi.spyOn(manager, 'settleAutoFarmOffline')

    const saveA = baseSave({ player: { ...player, lastSavedAt: Date.now() - 10_000_000 } })
    const saveB = baseSave({ player: { ...player, name: 'different-name', lastSavedAt: Date.now() - 10_000_000 } })

    manager.restoreFromSave(saveA)
    manager.restoreFromSave(saveB)

    expect(settleSpy).toHaveBeenCalledTimes(2)
  })
})
