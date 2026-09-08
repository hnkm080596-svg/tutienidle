// R7 (AR-08) - shared worker pool wiring at the REAL GameManager tick
// boundary (P13 lesson: unit tests on hand-built systems do not prove
// the running instance is wired). Decompose claims its workers from
// the CHQ capacity FIRST; production tickWorkers receives the
// remainder.
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { buildings } from '../../data/building/buildings'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'

function makeManager(): { manager: GameManager; player: PlayerData } {
  const manager = new GameManager()
  manager.registerBuildings(buildings)
  const player = createDefaultPlayer()
  manager.setActivePlayer(player)
  return { manager, player }
}

function enableAllProductionSites(manager: GameManager): void {
  // States are created lazily; iterate the DEFINITIONS, not the states.
  for (const definition of manager.productionSystem.getSiteDefinitions()) {
    manager.setProductionAutoRestart(definition.siteId, true)
  }
}

describe('GameManager shared worker pool (AR-08 wiring)', () => {
  it('decompose receives live capacity; production gets the remainder', () => {
    const { manager, player } = makeManager()

    // CHQ level 3 -> capacity 7 (authority: getWorkerCapacityForLevel).
    player.autoWorkerCapacity = 7

    manager.decomposeSystem.updateCapacity(7)
    manager.decomposeSystem.setSetting({ workers: 2 })

    enableAllProductionSites(manager)
    manager.update(1)

    expect(manager.decomposeSystem.getCapacity()).toBe(7)
    expect(manager.decomposeSystem.getSettings().workers).toBe(2)

    const totalProductionSlots = manager
      .productionSystem.getAllStates()
      .reduce((sum, state) => sum + state.activeWorkerSlots, 0)
    expect(totalProductionSlots).toBe(5) // 7 - 2 decompose
  })

  it('capacity 0 (no CHQ) starves both systems without errors', () => {
    const { manager } = makeManager()

    enableAllProductionSites(manager)
    manager.update(1)

    expect(manager.decomposeSystem.getCapacity()).toBe(0)
    expect(manager.decomposeSystem.getSettings().workers).toBe(0)
  })

  it('tick keeps decompose capacity synced when CHQ capacity changes mid-session', () => {
    const { manager, player } = makeManager()

    player.autoWorkerCapacity = 4
    manager.update(1)
    expect(manager.decomposeSystem.getCapacity()).toBe(4)

    player.autoWorkerCapacity = 9
    manager.update(1)
    expect(manager.decomposeSystem.getCapacity()).toBe(9)
  })
})
