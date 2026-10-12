import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { GameManagerEconomyOps } from './GameManagerEconomyOps'
import { createDefaultPlayer } from '../player/Player'

describe('Art-only Vendor command boundary', () => {
  it('rejects sales and publishes no commerce quotes or rows', () => {
    const manager = new GameManager()
    const player = createDefaultPlayer()
    const wood = { id: 'wood', name: 'Wood', category: 'wood' as const, sourceType: 'building' as const }
    manager.materialRegistry.register(wood)
    manager.materialBag.add(wood, 100)
    const before = manager.materialBag.getAll().map(stack => ({ ...stack }))
    const economyOps = new GameManagerEconomyOps({
      materialRegistry: manager.materialRegistry,
      materialBag: manager.materialBag,
      getAlchemyRecipes: () => [],
      notifyMaterialGained: () => {},
    })
    expect(economyOps.sellMaterialToVendor('wood', 1, player)).toEqual({ ok: false, reason: 'retired' })
    expect(economyOps.previewVendorSale('wood', 1, player)).toBeNull()
    expect(economyOps.getVendorSellableRows(player)).toEqual([])
    expect(manager.materialBag.getAll()).toEqual(before)
  })
})
