// Production sites progress independently with one pending cycle per owner.
import { describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises the scope-hidden
// system's ENABLED implementation (sec.11-15: dormant, not deleted),
// so the scope authority reports in-scope for this file.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { GameManager } from './GameManager'
import { buildings } from '../../data/building/buildings'
import { createDefaultPlayer } from '../player/Player'

function makeManager(): GameManager {
  const manager = new GameManager()

  manager.catalogOps.registerBuildings(buildings)

  return manager
}

describe('GameManager — independent production site progress', () => {
  it('full update starts one cycle for each enabled site without a shared worker pool', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    const definitions = manager.productionSystem.getSiteDefinitions()
    for (const definition of definitions) manager.buildingOps.setProductionAutoRestart(definition.siteId, true)
    manager.tickOps.update(1)

    for (const definition of definitions) {
      const cycles = manager.productionSystem.getState(definition.siteId)?.productionCycles ?? []
      expect(cycles).toHaveLength(1)
      expect(cycles[0]!.siteId).toBe(definition.siteId)
    }
  })

  it('untouched sites produce by default independently of an explicitly enabled site', () => {
    const manager = makeManager()
    manager.setActivePlayer(createDefaultPlayer())
    const [enabled, untouched] = manager.productionSystem.getSiteDefinitions()
    expect(enabled).toBeDefined()
    expect(untouched).toBeDefined()
    manager.buildingOps.setProductionAutoRestart(enabled!.siteId, true)
    manager.tickOps.update(1)

    expect(manager.productionSystem.getState(enabled!.siteId)?.productionCycles).toHaveLength(1)
    expect(manager.productionSystem.getState(untouched!.siteId)?.productionCycles ?? []).toHaveLength(1)
  })
})

