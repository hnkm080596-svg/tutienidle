import { describe, expect, it } from 'vitest'

import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { MERIDIANS } from '../../data/realm/Meridians'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import { createDefaultPlayer } from '../player/Player'
import { GameManager } from './GameManager'

// P7-M5 - the unified body-progression op dispatches through each
// chapter's currency descriptor: tinh_hoa_pham_the is a MATERIAL,
// thong_mach_dan is a type:'material' PILL (pillBag), and the final
// meridian's aux (thien_dia_chi_kieu) is a material CHECK (not consumed
// by the current contract).
describe('GameManagerRealmAdvanceOps.investBodyChapter', () => {
  function managerWithCatalogs(): GameManager {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    manager.catalogOps.registerPills(pills)
    return manager
  }

  it('material channel: debits tinh_hoa_pham_the from materialBag on success', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(TINH_HOA_PHAM_THE_MATERIAL_ID), 10)

    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')

    expect(consumed).toBe(10)
    expect(manager.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(0)
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(10)
  })

  it('pill channel: opens the next meridian and debits thong_mach_dan from pillBag', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 18
    manager.setActivePlayer(player)
    manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 5)

    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'meridian')

    expect(consumed).toBe(1)
    expect(manager.pillBag.getAmount('thong_mach_dan')).toBe(4)
    expect(player.bodyProgression.meridian.openedIds).toEqual(['nham_mach'])
    expect(player.modifiers.some(m => m.id.startsWith('bat-mach:'))).toBe(true)
  })

  it('aux check: the final meridian requires thien_dia_chi_kieu in materialBag (checked, not consumed)', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 18
    manager.setActivePlayer(player)
    player.bodyProgression.meridian.openedIds = MERIDIANS.slice(0, 8).map(m => m.id)
    manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 40)

    // No aux -> gated, nothing debited.
    expect(manager.realmAdvanceOps.investBodyChapter(player, 'meridian')).toBe(0)
    expect(manager.pillBag.getAmount('thong_mach_dan')).toBe(40)

    manager.materialBag.add(manager.materialRegistry.get('thien_dia_chi_kieu'), 1)

    expect(manager.realmAdvanceOps.investBodyChapter(player, 'meridian')).toBe(40)
    expect(player.bodyProgression.meridian.openedIds).toHaveLength(9)
    expect(manager.pillBag.getAmount('thong_mach_dan')).toBe(0)
    // Aux is a possession check, not consumed (preserved contract).
    expect(manager.materialBag.getAmount('thien_dia_chi_kieu')).toBe(1)
  })

  it('gated invest returns 0 without touching either bag', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 1 // Luyen Bi locked
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(TINH_HOA_PHAM_THE_MATERIAL_ID), 10)

    expect(manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')).toBe(0)
    expect(manager.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(10)
  })
})
