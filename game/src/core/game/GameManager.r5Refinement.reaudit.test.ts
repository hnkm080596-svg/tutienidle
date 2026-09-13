import { describe, expect, it, vi } from 'vitest'
import { materials } from '../../data/materials/materials'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'

describe('R5 headless body refinement ownership', () => {
  it('auto-invests available essence through the real manager update without App or Phaser', () => {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)
    const material = manager.materialRegistry.get(TINH_HOA_PHAM_THE_MATERIAL_ID)
    manager.materialBag.add(material, 1)
    manager.tickOps.update(0.1)
    expect.soft(player.bodyRefinementCurrentTierProgress).toBe(1)
    expect.soft(manager.materialBag.getAmount(material.id)).toBe(0)
    // Control proves eligibility and the domain operation itself are valid.
    if (player.bodyRefinementCurrentTierProgress === 0) {
      expect(manager.realmAdvanceOps.investBodyRefinement(player)).toBe(1)
      expect(player.bodyRefinementCurrentTierProgress).toBe(1)
    }
  })

  // F7 (QA-2026-09-09-RR7): exactly-once domain side effect per update.
  // investTinhHoa is idempotent on progress, so progress cannot distinguish
  // one attempt from two; the attempt count itself is the oracle.
  it('attempts body refinement auto-invest exactly once per update', () => {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)

    const investSpy = vi.spyOn(manager.realmAdvanceOps, 'investBodyRefinement')

    manager.tickOps.update(0.1)

    expect(investSpy).toHaveBeenCalledTimes(1)
  })
})
