// R7 (AR-08) - worker pool wiring at the REAL GameManager tick
// boundary (P13 lesson: unit tests on hand-built systems do not prove
// the running instance is wired). DIRECT DECOMPOSE REWORK (2026-10-11):
// decompose retired its worker claim (direct multi-select action), so
// production tickWorkers receives the WHOLE CHQ capacity.
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
import type { PlayerData } from '../player/Player'

function makeManager(): { manager: GameManager; player: PlayerData } {
  const manager = new GameManager()
  manager.catalogOps.registerBuildings(buildings)
  const player = createDefaultPlayer()
  manager.setActivePlayer(player)
  return { manager, player }
}

function enableAllProductionSites(manager: GameManager): void {
  // States are created lazily; iterate the DEFINITIONS, not the states.
  for (const definition of manager.productionSystem.getSiteDefinitions()) {
    manager.buildingOps.setProductionAutoRestart(definition.siteId, true)
  }
}

describe('GameManager worker pool (AR-08 wiring)', () => {
  function totalProductionSlots(manager: GameManager): number {
    return manager
      .productionSystem.getAllStates()
      .reduce((sum, state) => sum + state.activeWorkerSlots, 0)
  }

  it('production receives the whole CHQ pool (no decompose claim)', () => {
    const { manager, player } = makeManager()

    // CHQ level 3 -> capacity 7 (authority: getWorkerCapacityForLevel).
    player.autoWorkerCapacity = 7

    enableAllProductionSites(manager)
    manager.tickOps.update(1)

    // Round-robin fills every capacity unit into a lane - the whole
    // pool lands on production.
    expect(totalProductionSlots(manager)).toBe(7)
  })

  it('capacity 0 (no CHQ) starves production without errors', () => {
    const { manager } = makeManager()

    enableAllProductionSites(manager)
    manager.tickOps.update(1)

    expect(totalProductionSlots(manager)).toBe(0)
  })

  it('tick keeps production capacity synced when CHQ capacity changes mid-session', () => {
    const { manager, player } = makeManager()

    enableAllProductionSites(manager)

    player.autoWorkerCapacity = 4
    manager.tickOps.update(1)
    expect(totalProductionSlots(manager)).toBe(4)

    player.autoWorkerCapacity = 9
    manager.tickOps.update(1)
    expect(totalProductionSlots(manager)).toBe(9)
  })
})
