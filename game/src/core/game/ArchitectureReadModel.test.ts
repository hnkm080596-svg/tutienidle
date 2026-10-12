import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { buildings } from '../../data/building/buildings'
import { getArchitectureBuildingModels } from './ArchitectureReadModel'

describe('Architecture read model owner', () => {
  it('uses domain quotes without creating or upgrading building state', () => {
    const manager = new GameManager()
    manager.catalogOps.registerBuildings(buildings)
    const player = createDefaultPlayer()
    expect(getArchitectureBuildingModels(manager, player)).toHaveLength(6)
    expect(manager.buildingManager.getAll()).toHaveLength(0)
    manager.buildingOps.reconcileBuildings(player, 0)
    const before = manager.buildingManager.getAll().map(entry => ({ ...entry }))
    const models = getArchitectureBuildingModels(manager, player)
    expect(models.find(entry => entry.id === 'vendor')).toMatchObject({ artOnly: true, maxed: true, canUpgrade: false })
    expect(models.find(entry => entry.id === 'chi_hien_quan')).toMatchObject({ artOnly: true, maxed: true, canUpgrade: false })
    expect(models.find(entry => entry.id === 'pill_room')?.currentEffects).toContainEqual({ key: 'queueSlots', value: 3, unit: 'count' })
    expect(manager.buildingManager.getAll()).toEqual(before)
  })
})
