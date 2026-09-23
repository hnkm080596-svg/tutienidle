import { describe, expect, it } from 'vitest'

import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { BODY_REFINEMENT_TIERS, TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import { createDefaultPlayer } from '../player/Player'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import type { GameSave } from '../../services/save/SaveSystem'
import { GameManager } from './GameManager'

// M-QI-07 (QI-D4) - the real production invest seam: GameManager's
// bag-debit op completing 6/6 body_refinement must transform
// physiqueGrade pham -> bao while debiting ONLY consumed essence.
describe('GameManagerRealmAdvanceOps.investBodyChapter - physique transform', () => {
  function managerWithCatalogs(): GameManager {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    manager.catalogOps.registerPills(pills)
    return manager
  }

  it('completing 6/6 through the real op transforms pham -> bao and debits only consumed essence', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)

    const material = manager.materialRegistry.get(TINH_HOA_PHAM_THE_MATERIAL_ID)
    const totalCost = BODY_REFINEMENT_TIERS.reduce((sum, tier) => sum + tier.cap, 0)

    // The material bag clamps at MAX_STACK_AMOUNT (1000) per stack -
    // real play tops up and invests repeatedly, so mirror that: top the
    // stack to 1000 before every op call until the chapter is complete.
    let storedTotal = 0
    const topUp = (amount: number): void => {
      storedTotal += amount - manager.materialBag.add(material, amount)
    }

    let guard = 0
    while (player.bodyProgression.body_refinement.completedTiers < 6 && guard++ < 100) {
      topUp(1000)
      const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')
      expect(consumed).toBeGreaterThan(0)
    }

    expect(player.bodyProgression.body_refinement.completedTiers).toBe(6)
    expect(player.physiqueGrade).toBe('bao')
    // Exactly consumed = sum of all caps - whatever was stored minus
    // the bag remainder is precisely the chapter's cost.
    const remainder = manager.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)
    expect(storedTotal - remainder).toBe(totalCost)

    // Post-completion the op consumes 0 and the grade is stable.
    const bagBefore = manager.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)
    expect(manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')).toBe(0)
    expect(manager.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(bagBefore)
    expect(player.physiqueGrade).toBe('bao')
  })
})

// M-F-BODY-CORE - the restore contract through the REAL session-load
// entry point: GameManager.saveOps.restoreFromSave runs the body
// preflight (assertBodyProgressionIntegrity) before any owner mutation.
// The persisted physiqueGrade is authoritative: an advanced grade
// restores unchanged; a behind-grade torn state is REJECTED and never
// auto-advanced by the restore path.
describe('GameManager.saveOps.restoreFromSave - physique restore contract', () => {
  function managerWithCatalogs(): GameManager {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    manager.catalogOps.registerPills(pills)
    return manager
  }

  function baseSave(player: ReturnType<typeof createDefaultPlayer>): GameSave {
    return {
      version: CURRENT_SAVE_VERSION,
      player,
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
    }
  }

  it('a completed chapter + persisted advanced grade restores unchanged', () => {
    const manager = managerWithCatalogs()
    const live = createDefaultPlayer()
    manager.setActivePlayer(live)

    const saved = createDefaultPlayer()
    saved.realmId = 'qi_refining'
    saved.physiqueGrade = 'bao'
    saved.bodyProgression.body_refinement.completedTiers = 6
    const save = baseSave(saved)

    expect(() => manager.saveOps.restoreFromSave(save)).not.toThrow()
    // The persisted grade is restored as-is - never re-derived or
    // re-applied by the restore path.
    expect(save.player.physiqueGrade).toBe('bao')
  })

  it('a completed chapter + behind-grade save is rejected before any owner mutation', () => {
    const manager = managerWithCatalogs()
    const live = createDefaultPlayer()
    manager.setActivePlayer(live)
    manager.materialBag.add(manager.materialRegistry.get(TINH_HOA_PHAM_THE_MATERIAL_ID), 5)

    const saved = createDefaultPlayer()
    saved.realmId = 'qi_refining'
    saved.bodyProgression.body_refinement.completedTiers = 6
    // physiqueGrade stays 'pham' - torn: no recompute on restore.
    const save = baseSave(saved)

    expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/physique/i)
    // Rejection heals nothing: the payload is not auto-advanced and the
    // live state is untouched (preflight runs before any mutation).
    expect(save.player.physiqueGrade).toBe('pham')
    expect(manager.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(5)
  })
})
