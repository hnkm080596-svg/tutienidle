// R7 (AR-08) — DecomposeSystem capacity must be DYNAMIC: the live
// workforce capacity reaches the running instance through an explicit
// update command instead of a constructor-only constant 0. The old
// wiring made the UI's worker request silently clamp to zero.
import { describe, expect, it } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { materials } from '../../data/materials/materials'
import { DecomposeSystem } from './DecomposeSystem'

function makeSystem(): { system: DecomposeSystem; bag: MaterialBag; registry: MaterialRegistry } {
  const registry = new MaterialRegistry()
  for (const material of materials) {
    registry.register(material)
  }
  const bag = new MaterialBag()
  return { system: new DecomposeSystem(bag, { cycleSeconds: 30 }), bag, registry }
}

describe('DecomposeSystem dynamic capacity (AR-08)', () => {
  it('starts at capacity 0 and clamps workers to 0', () => {
    const { system } = makeSystem()
    system.setSetting({ workers: 6 })
    expect(system.getSettings().workers).toBe(0)
  })

  it('updateCapacity raises the ceiling; setSetting clamps to it', () => {
    const { system } = makeSystem()
    system.updateCapacity(4)
    expect(system.getCapacity()).toBe(4)
    system.setSetting({ workers: 6 })
    expect(system.getSettings().workers).toBe(4)
  })

  it('updateCapacity shrinks current workers (CHQ downgrade / stale save)', () => {
    const { system } = makeSystem()
    system.updateCapacity(6)
    system.setSetting({ workers: 6 })
    system.updateCapacity(2)
    expect(system.getSettings().workers).toBe(2)
  })

  it('floors and rejects negative capacity', () => {
    const { system } = makeSystem()
    system.updateCapacity(3.9)
    expect(system.getCapacity()).toBe(3)
    system.updateCapacity(-5)
    expect(system.getCapacity()).toBe(0)
    expect(system.getSettings().workers).toBe(0)
  })
})
