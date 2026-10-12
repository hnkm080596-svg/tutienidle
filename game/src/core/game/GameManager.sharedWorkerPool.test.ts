// Production sites progress independently at the REAL GameManager tick boundary.
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
  manager.setActivePlayer(createDefaultPlayer())
  return manager
}

function enableAllProductionSites(manager: GameManager): void {
  // States are created lazily; iterate the DEFINITIONS, not the states.
  for (const definition of manager.productionSystem.getSiteDefinitions()) {
    manager.buildingOps.setProductionAutoRestart(definition.siteId, true)
  }
}

describe('GameManager independent production site ticks', () => {
  it('each enabled site owns one pending cycle after the real manager tick', () => {
    const manager = makeManager()
    const definitions = manager.productionSystem.getSiteDefinitions()
    enableAllProductionSites(manager)
    manager.tickOps.update(1)

    for (const definition of definitions) {
      expect(manager.productionSystem.getState(definition.siteId)?.productionCycles).toHaveLength(1)
    }
  })

  it('repeated ticks do not queue another cycle while a site cycle is pending', () => {
    const manager = makeManager()
    const definition = manager.productionSystem.getSiteDefinitions()[0]!
    manager.buildingOps.setProductionAutoRestart(definition.siteId, true)
    manager.tickOps.update(1)
    manager.tickOps.update(1)

    expect(manager.productionSystem.getState(definition.siteId)?.productionCycles).toHaveLength(1)
  })

  it('negative and zero elapsed updates do not start cycles', () => {
    const manager = makeManager()
    enableAllProductionSites(manager)
    manager.tickOps.update(0)
    manager.tickOps.update(-1)

    expect(manager.productionSystem.getAllStates().every((state) => (state.productionCycles?.length ?? 0) === 0)).toBe(true)
  })
})
