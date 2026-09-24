import { describe, expect, it } from 'vitest'

import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { MERIDIANS } from '../../data/realm/Meridians'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import { ZHOU_TIAN_CURRENCY_MATERIAL_ID } from '../../data/realm/ZhouTian'
import { createDefaultPlayer } from '../player/Player'
import { GameManager } from './GameManager'

// P7-M5 - the unified body-progression op dispatches through each
// chapter's currency descriptor: tinh_hoa_pham_the is a MATERIAL and
// thong_mach_dan is a type:'material' PILL (pillBag). The ninth
// meridian and its thien_dia_chi_kieu aux check retired 2026-09-23
// (hidden-perfection-lineage sec.19) - every meridian opens on pills.
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
    // M-F-CHU-THIEN (C2C-59): meridian is sequentially gated on
    // completed refinement - the fixture carries a coherent state.
    player.physiqueGrade = 'bao'
    player.bodyProgression.body_refinement.completedTiers = 6
    manager.setActivePlayer(player)
    manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 5)

    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'meridian')

    expect(consumed).toBe(1)
    expect(manager.pillBag.getAmount('thong_mach_dan')).toBe(4)
    expect(player.bodyProgression.meridian.openedIds).toEqual(['nham_mach'])
    expect(player.modifiers.some(m => m.id.startsWith('bat-mach:'))).toBe(true)
  })

  it('the final meridian opens on pills alone - no material gate (sec.19: ninth meridian + aux retired)', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 18
    // Coherent prerequisite chain (C2C-59/64): 7 opened meridians
    // requires completed refinement + the mirrored grade.
    player.physiqueGrade = 'bao'
    player.bodyProgression.body_refinement.completedTiers = 6
    manager.setActivePlayer(player)
    player.bodyProgression.meridian.openedIds = MERIDIANS.slice(0, 7).map(m => m.id)
    manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 40)

    // doc_mach costs 30 thong_mach_dan and no longer asks for any
    // material aux - the invest goes through on pills alone.
    expect(manager.realmAdvanceOps.investBodyChapter(player, 'meridian')).toBe(30)
    expect(player.bodyProgression.meridian.openedIds).toHaveLength(8)
    expect(manager.pillBag.getAmount('thong_mach_dan')).toBe(10)
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

  it('material channel: zhou_tian consumes tinh_hoa_phap_the exactly (no substitution)', () => {
    // M-F-CHU-THIEN (C2C-64) - the authored currency contract:
    // ZHOU_TIAN_CURRENCY_MATERIAL_ID is the single source and IS the
    // Phap essence; the ops seam debits it 1:1 against capacity.
    expect(ZHOU_TIAN_CURRENCY_MATERIAL_ID).toBe('tinh_hoa_phap_the')

    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 1 // capacity 20
    manager.setActivePlayer(player)
    completeBodyPrerequisites(player) // meridian complete -> unlocked
    manager.materialBag.add(manager.materialRegistry.get('tinh_hoa_phap_the'), 7)

    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'zhou_tian')

    expect(consumed).toBe(7)
    expect(manager.materialBag.getAmount('tinh_hoa_phap_the')).toBe(0)
    expect(player.bodyProgression.zhou_tian.circulation).toBe(7)
  })

  it('zhou_tian invest is capacity-clamped, no-debit when empty, and locked under the sequential gate', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 1 // capacity 20
    manager.setActivePlayer(player)
    completeBodyPrerequisites(player)
    player.bodyProgression.zhou_tian.circulation = 18
    manager.materialBag.add(manager.materialRegistry.get('tinh_hoa_phap_the'), 50)

    // Over-owned + remaining capacity 2 -> consumes exactly 2.
    expect(manager.realmAdvanceOps.investBodyChapter(player, 'zhou_tian')).toBe(2)
    expect(manager.materialBag.getAmount('tinh_hoa_phap_the')).toBe(48)
    expect(player.bodyProgression.zhou_tian.circulation).toBe(20)

    // At capacity -> zero debit, idempotent.
    expect(manager.realmAdvanceOps.investBodyChapter(player, 'zhou_tian')).toBe(0)
    expect(manager.materialBag.getAmount('tinh_hoa_phap_the')).toBe(48)

    // Locked (meridian incomplete) -> zero debit even with essence owned.
    const locked = createDefaultPlayer()
    locked.realmId = 'foundation_establishment'
    locked.realmLevel = 1
    locked.physiqueGrade = 'bao'
    locked.bodyProgression.body_refinement.completedTiers = 6
    locked.bodyProgression.meridian.openedIds = MERIDIANS.slice(0, 7).map(m => m.id)
    manager.setActivePlayer(locked)
    expect(manager.realmAdvanceOps.investBodyChapter(locked, 'zhou_tian')).toBe(0)
    expect(manager.materialBag.getAmount('tinh_hoa_phap_the')).toBe(48)
    expect(locked.bodyProgression.zhou_tian.circulation).toBe(0)
  })
})

// M-F-CHU-THIEN - a coherent post-refinement state: 6/6 refinement
// (+ mirrored bao grade) and all eight meridians open.
function completeBodyPrerequisites(player: ReturnType<typeof createDefaultPlayer>): void {
  player.physiqueGrade = 'bao'
  player.bodyProgression.body_refinement.completedTiers = 6
  player.bodyProgression.meridian.openedIds = MERIDIANS.map(m => m.id)
}
