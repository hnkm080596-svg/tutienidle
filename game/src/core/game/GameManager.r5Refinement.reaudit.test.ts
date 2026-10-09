import { describe, expect, it, vi } from 'vitest'
import { materials } from '../../data/materials/materials'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'

// Owner ruling 2026-10-09: auto-nuốt removed - drops pool in the bag and
// the player pours them manually from the Luyện Thể panel. The tick no
// longer owns body_refinement at all.
describe('R5 headless body refinement ownership', () => {
  it('holds essence in the bag across updates until a manual pour, without App or Phaser', () => {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    const material = manager.materialRegistry.get(TINH_HOA_PHAM_THE_MATERIAL_ID)
    manager.materialBag.add(material, 1)

    for (let index = 0; index < 5; index++) manager.tickOps.update(0.1)
    expect.soft(player.bodyProgression.body_refinement.currentTierProgress).toBe(0)
    expect.soft(manager.materialBag.getAmount(material.id)).toBe(1)

    // The manual pour still converts the pooled drop.
    expect(manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')).toBe(1)
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(1)
    expect(manager.materialBag.getAmount(material.id)).toBe(0)
  })

  // F7 (QA-2026-09-09-RR7): the tick never calls the invest op anymore -
  // manual pour is the only production invest path.
  it('never attempts body refinement invest on update', () => {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)

    const investSpy = vi.spyOn(manager.realmAdvanceOps, 'investBodyChapter')

    manager.tickOps.update(0.1)

    expect(investSpy).not.toHaveBeenCalled()
  })
})
