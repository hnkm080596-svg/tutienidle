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
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'

function makeManager(): { manager: GameManager; player: ReturnType<typeof createDefaultPlayer> } {
  const manager = new GameManager()
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerMaterials(materials)
  const player = createDefaultPlayer()
  manager.setActivePlayer(player)
  return { manager, player }
}

// INV-R7-2: pool accounting under adversarial overcommit.
describe('QA R7 - pool boundedness', () => {
  it('production slots never exceed total capacity (overcommit)', () => {
    const { manager, player } = makeManager()
    player.autoWorkerCapacity = 5
    manager.tickOps.update(1)

    // Manual assignment asks for MORE than the whole pool - the
    // allocator clamps at the pool edge (no claimant ahead of it).
    const siteId = manager.productionSystem.getSiteDefinitions()[0]!.siteId
    manager.buildingOps.setProductionAutoRestart(siteId, true)
    manager.buildingOps.assignWorkers(siteId, 99)

    manager.tickOps.update(1)

    const productionSlots = manager
      .productionSystem.getAllStates()
      .reduce((sum, state) => sum + state.activeWorkerSlots, 0)
    expect(productionSlots).toBe(5)
    expect(productionSlots).toBeLessThanOrEqual(5)
  })
})

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

  it('legacy decompose slice restores inertly: no mint, no ore spend, retry-safe', () => {
    // DIRECT REWORK: a pre-rework save carries a live mid-cycle
    // decompose payload (workers + past-due deadline). Restore must
    // accept-and-ignore it - never resurrect worker behavior: no tinh
    // hoa is minted offline and no ore is consumed.
    const source = makeManager()

    const save = baseSave(source.player)
    save.player.lastSavedAt = Date.now() - 61_000
    save.decompose = {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 2 },
      nextCycleAt: Date.now() - 60_000,
      started: true,
    }

    const ore = source.manager.materialRegistry.has('mortal_ore_decade')
      ? source.manager.materialRegistry.get('mortal_ore_decade')
      : undefined
    expect(ore).toBeDefined()
    save.materials = [{ materialId: ore!.id, amount: 1000 }]

    // Boot a FRESH manager from the save (the real app restores at
    // boot, before any tick loop runs on this instance).
    const target = makeManager()
    target.manager.saveOps.restoreFromSave(save)

    const tinhHoa = (): number =>
      target.manager.materialBag.getAll().find((s) => s.material.id === LUYEN_KHI_TINH_HOA_ID)?.amount ?? 0
    const oreAmount = (): number => target.manager.materialBag.getAmount(ore!.id)

    expect(tinhHoa()).toBe(0)
    expect(oreAmount()).toBe(1000)

    // Boot-retry: restoring the SAME payload again on the same instance
    // stays inert too.
    target.manager.saveOps.restoreFromSave(save)

    expect(tinhHoa()).toBe(0)
    expect(oreAmount()).toBe(1000)
  })
})
