// QA deep audit (R7) - adversarial checks for the decompose persistence
// slice and the shared worker pool split. These tests attack the NEW
// save boundary (decompose slice) and the pool accounting invariants.
// They are written to PASS against correct behavior; a failure is a
// confirmed defect (failing-for-the-intended-reason evidence).
import { withMortalCreationPick } from '../../services/save/GameSave.fixture'
import { describe, expect, it } from 'vitest'
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
describe('QA R7 - shared pool boundedness', () => {
  it('decompose + production slots never exceed total capacity (overcommit)', () => {
    const { manager, player } = makeManager()
    player.autoWorkerCapacity = 5
    manager.tickOps.update(1)
    manager.decomposeSystem.setSetting({ workers: 5 })

    // Production manual assignment asks for MORE than the remainder 0.
    const siteId = manager.productionSystem.getSiteDefinitions()[0]!.siteId
    manager.buildingOps.setProductionAutoRestart(siteId, true)
    manager.buildingOps.assignWorkers(siteId, 4)

    manager.tickOps.update(1)

    const decomposeWorkers = manager.decomposeSystem.getSettings().workers
    const productionSlots = manager
      .productionSystem.getAllStates()
      .reduce((sum, state) => sum + state.activeWorkerSlots, 0)
    // Decompose claimed 5; production must receive 0 remainder even
    // though a manual assignment asked for 4 (allocator clamps).
    expect(decomposeWorkers).toBe(5)
    expect(productionSlots).toBe(0)
    expect(decomposeWorkers + productionSlots).toBeLessThanOrEqual(5)
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

  it('restore twice from the same save does not double-award decompose output', () => {
    // Source session: build a mid-cycle decompose state with 2 workers.
    const source = makeManager()
    source.player.autoWorkerCapacity = 2
    source.manager.tickOps.update(1)
    source.manager.decomposeSystem.setSetting({ workers: 2 })
    source.manager.tickOps.update(1)

    const save = baseSave(source.player)
    save.decompose = source.manager.decomposeSystem.getSaveState()

    // The save says the player was last seen 61s ago and the decompose
    // cycle deadline fell 60s ago (two 30s cycles are due inside the
    // offline window). Ore must be IN the save so the restored bag can
    // feed the offline decompose cycles (restore is additive).
    save.player.lastSavedAt = Date.now() - 61_000
    save.decompose!.nextCycleAt = Date.now() - 60_000

    const ore = source.manager.materialRegistry.has('mortal_ore_decade')
      ? source.manager.materialRegistry.get('mortal_ore_decade')
      : undefined
    expect(ore).toBeDefined()
    save.materials = [{ materialId: ore!.id, amount: 1000 }]

    // Boot a FRESH manager from the save (the real app restores at
    // boot, before any tick loop runs on this instance).
    const target = makeManager()
    target.player.autoWorkerCapacity = 2
    target.manager.saveOps.restoreFromSave(save)
    const tinhHoaAfterFirst =
      target.manager.materialBag.getAll().find((s) => s.material.id === LUYEN_KHI_TINH_HOA_ID)?.amount ?? 0

    // Boot-retry: restore the SAME payload again on the same instance
    // (retry-load path). The live timer has advanced past the settled
    // window, so the second restore must not replay it.
    target.manager.materialBag.add(ore!, 1000)
    target.manager.saveOps.restoreFromSave(save)
    const tinhHoaAfterSecond =
      target.manager.materialBag.getAll().find((s) => s.material.id === LUYEN_KHI_TINH_HOA_ID)?.amount ?? tinhHoaAfterFirst

    expect(tinhHoaAfterFirst).toBeGreaterThan(0)
    expect(tinhHoaAfterSecond).toBe(tinhHoaAfterFirst)
  })
})
