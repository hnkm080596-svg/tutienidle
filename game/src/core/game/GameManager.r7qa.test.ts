// QA deep audit (R7) - adversarial checks for the decompose persistence
// slice and the worker pool accounting invariants. DIRECT DECOMPOSE
// REWORK (2026-10-11): the worker-cycle engine retired - the slice is
// accept-and-ignore and no claimant sits ahead of production. These
// tests attack the save boundary and the pool invariants; they are
// written to PASS against correct behavior.
import { withMortalCreationPick } from '../../services/save/GameSave.fixture'
import { describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises the scope-hidden
// system's ENABLED implementation (sec.11-15: dormant, not deleted),
// so the scope authority reports in-scope for this file.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  isBetaQuestEnabled: () => true,
  betaRecipeFamilyOfId: () => 'tu_linh_dan',
}))

import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { buildings } from '../../data/building/buildings'
import { materials } from '../../data/materials/materials'
import type { GameSave } from '../../services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'

function makeManager(): { manager: GameManager; player: ReturnType<typeof createDefaultPlayer> } {
  const manager = new GameManager()
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerMaterials(materials)
  const player = createDefaultPlayer()
  manager.setActivePlayer(player)
  return { manager, player }
}

// INV-R7-3: boot boundary with adversarial decompose payloads.
describe('QA R7 - decompose slice boot safety', () => {
  function baseSave(player: ReturnType<typeof createDefaultPlayer>): GameSave {
    return withMortalCreationPick({
      version: CURRENT_SAVE_VERSION,
      player: { ...player, lastSavedAt: Date.now() },
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
    })
  }

  it('legacy worker settings and overdue deadline stay inert across repeated restore', () => {
    const source = makeManager()
    const save = baseSave(source.player)
    save.player.lastSavedAt = Date.now() - 61_000
    save.decompose = {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 2 },
      nextCycleAt: Date.now() - 60_000,
      started: true,
    }
    const ore = source.manager.materialRegistry.get('material_spirit_ore_decade')
    expect(ore).toBeDefined()
    save.materials = [{ materialId: ore!.id, amount: 1000 }]

    const target = makeManager()
    target.manager.saveOps.restoreFromSave(save)
    expect(target.manager.materialBag.getAmount(ore!.id)).toBe(1000)
    target.manager.saveOps.restoreFromSave(save)
    target.manager.tickOps.update(61)

    expect(target.manager.materialBag.getAmount(ore!.id)).toBe(1000)
    expect(target.manager.decomposeSystem.getSaveState()).toEqual({})
  })
})
