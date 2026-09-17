import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { materials } from '../../data/materials/materials'

// Mission G Task 13 - decompose output is produced by buildings, so the
// registry-miss fallback is a fully typed Material (no `as never`).
describe('deliverDecomposeOutput — typed Material fallback', () => {
  it('an unregistered materialId still lands in the bag under the typed fallback', () => {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    manager.setActivePlayer(createDefaultPlayer())

    manager.tickOps.deliverDecomposeOutput({ materialId: 'unregistered_tinh_hoa', amount: 3 })

    const stack = manager.materialBag
      .getAll()
      .find((entry) => entry.material.id === 'unregistered_tinh_hoa')

    expect(stack).toBeDefined()
    expect(stack!.amount).toBe(3)
    expect(stack!.material.name).toBe('unregistered_tinh_hoa')
    expect(stack!.material.category).toBe('other')
    expect(stack!.material.sourceType).toBe('building')

    const notifications = manager.drainNotifications()
    expect(
      notifications.some(
        (event) => event.kind === 'craft' && event.message.includes('unregistered_tinh_hoa'),
      ),
    ).toBe(true)
  })
})
