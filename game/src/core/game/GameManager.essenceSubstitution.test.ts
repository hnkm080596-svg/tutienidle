import { describe, expect, it, vi } from 'vitest'

import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import { createDefaultPlayer } from '../player/Player'
import { GameManager } from './GameManager'

const PHAM = TINH_HOA_PHAM_THE_MATERIAL_ID
const BAO = 'tinh_hoa_bao_the'
const PHAP = 'tinh_hoa_phap_the'

// M-QI-09 (QI-D4c) - the substitution contract end-to-end on the real
// invest seam: downward-only spend at the locked adjacent ratio,
// exact-value change-back, all-or-nothing debit, and the namespace
// gate refusing pill currencies (C2C rulings round 10).
describe('investBodyChapter essence substitution (M-QI-09)', () => {
  function managerWithCatalogs(): GameManager {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    manager.catalogOps.registerPills(pills)
    return manager
  }

  it('substitutes bao essence for a pham shortfall at the locked ratio', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining' // unlocks every mortal-pace tier gate
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(BAO), 25)

    // Tier 1 cap is 50 pham-equivalent; 25 bao at ratio 2 covers it.
    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')

    expect(consumed).toBe(50)
    expect(manager.materialBag.getAmount(BAO)).toBe(0)
    expect(manager.materialBag.getAmount(PHAM)).toBe(0)
    expect(player.bodyProgression.body_refinement.completedTiers).toBe(1)
  })

  it('spends the required currency first, then substitutes only the shortfall', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(PHAM), 30)
    manager.materialBag.add(manager.materialRegistry.get(BAO), 10)

    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')

    // 30 pham + 10 bao (20 covered) = 50 exactly - no change-back.
    expect(consumed).toBe(50)
    expect(manager.materialBag.getAmount(PHAM)).toBe(0)
    expect(manager.materialBag.getAmount(BAO)).toBe(0)
    expect(player.bodyProgression.body_refinement.completedTiers).toBe(1)
  })

  it('credits the whole-unit overpay back in the required material (exact change)', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(PHAM), 1)
    manager.materialBag.add(manager.materialRegistry.get(BAO), 25)

    // Shortfall 49 -> ceil(49/2) = 25 bao covering 50: the 1-unit
    // overpay returns as pham inside the same transaction.
    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')

    expect(consumed).toBe(50)
    expect(manager.materialBag.getAmount(BAO)).toBe(0)
    expect(manager.materialBag.getAmount(PHAM)).toBe(1)
    expect(player.bodyProgression.body_refinement.completedTiers).toBe(1)
  })

  it('compounds phap across two hops at the product rate', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(PHAP), 13)

    // Phap yield is 2x2 = 4; 13 phap covers 52, spent ceil(50/4) = 13
    // for tier 1 (cap 50) -> 2 pham change.
    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')

    expect(consumed).toBe(50)
    expect(manager.materialBag.getAmount(PHAP)).toBe(0)
    expect(manager.materialBag.getAmount(PHAM)).toBe(2)
    expect(player.bodyProgression.body_refinement.completedTiers).toBe(1)
  })

  it('insufficient-even-with-substitution consumes only what exists, debiting it all', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(PHAM), 5)
    manager.materialBag.add(manager.materialRegistry.get(BAO), 3)

    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')

    // 5 + 3*2 = 11 coverable - the chapter takes what is offered.
    expect(consumed).toBe(11)
    expect(manager.materialBag.getAmount(PHAM)).toBe(0)
    expect(manager.materialBag.getAmount(BAO)).toBe(0)
    expect(player.bodyProgression.body_refinement.completedTiers).toBe(0)
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(11)
  })

  it('apply-side rejection (C2C 3): a gated invest debits nothing even with substitutes owned', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 1 // Luyen Bi tier still locked at mortal pace
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(PHAM), 5)
    manager.materialBag.add(manager.materialRegistry.get(BAO), 25)

    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')

    expect(consumed).toBe(0)
    expect(manager.materialBag.getAmount(PHAM)).toBe(5)
    expect(manager.materialBag.getAmount(BAO)).toBe(25)
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(0)
  })

  it('a completed chapter rejects the invest outright - bags and state unchanged', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    player.bodyProgression.body_refinement.completedTiers = 6
    manager.materialBag.add(manager.materialRegistry.get(BAO), 25)

    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')

    expect(consumed).toBe(0)
    expect(manager.materialBag.getAmount(BAO)).toBe(25)
  })

  it('an unsatisfiable debit aborts the whole invest - zero state change (C2C r17#1)', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(PHAM), 10)
    manager.materialBag.add(manager.materialRegistry.get(BAO), 25)

    // Sabotage the preflight oracle: the plan is built from truth
    // (getAmount) but every satisfiability check fails.
    vi.spyOn(manager.materialBag, 'has').mockReturnValue(false)

    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')

    expect(consumed).toBe(0)
    expect(manager.materialBag.getAmount(PHAM)).toBe(10)
    expect(manager.materialBag.getAmount(BAO)).toBe(25)
    expect(player.bodyProgression.body_refinement.completedTiers).toBe(0)
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(0)
  })

  it('a change credit that cannot land aborts the invest atomically (C2C r17#2)', () => {
    // Fixture: the required material can hold at most 1 unit - a
    // multi-hop overpay of 2 pham can never be credited.
    const capped = materials.map((material) =>
      material.id === PHAM ? { ...material, stackLimit: 1 } : material,
    )
    // registerMaterials skips already-registered ids - the capped
    // catalog must be the first registration on a fresh manager.
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(capped)
    manager.catalogOps.registerPills(pills)
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(PHAP), 13)

    // 13 phap covers 52; consumed would be 50 -> change 2 > headroom 1.
    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')

    expect(consumed).toBe(0)
    expect(manager.materialBag.getAmount(PHAP)).toBe(13)
    expect(manager.materialBag.getAmount(PHAM)).toBe(0)
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(0)
  })

  it('the update() auto-invest tick resolves substitution through the same seam', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(BAO), 25)

    // Per-tick auto-invest is the production invest path - a headless
    // update must consume the substitute exactly like the direct seam.
    manager.tickOps.update(0.1)

    expect(manager.materialBag.getAmount(BAO)).toBeLessThan(25)
    expect(
      player.bodyProgression.body_refinement.currentTierProgress +
        player.bodyProgression.body_refinement.completedTiers * 50,
    ).toBeGreaterThan(0)
  })

  it('namespace gate (C2C 6): the meridian pill currency never substitutes physique essence', () => {
    const manager = managerWithCatalogs()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 18
    manager.setActivePlayer(player)
    manager.materialBag.add(manager.materialRegistry.get(BAO), 25)

    // Meridian costs thong_mach_dan PILLS - no substitution even
    // though essence material stacks sit in the bag.
    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'meridian')

    expect(consumed).toBe(0)
    expect(manager.materialBag.getAmount(BAO)).toBe(25)
    expect(player.bodyProgression.meridian.openedIds).toHaveLength(0)
  })
})
