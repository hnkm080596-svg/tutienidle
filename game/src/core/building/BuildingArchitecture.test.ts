import { describe, expect, it } from 'vitest'
import { buildings } from '../../data/building/buildings'
import { BuildingSystem } from './BuildingSystem'

describe('Architecture building rulings', () => {
  it.each([1, 2, 9])('room level %s supplies three waiting slots per level and one active kiln', level => {
    const room = buildings.find(entry => entry.id === 'pill_room')!
    expect(new BuildingSystem().getCraftModifiers({ instanceId: 'room', buildingId: room.id, level, lastCollectedAt: 0 }, room))
      .toMatchObject({ alchemyQueueSlots: level * 3, concurrentJobSlots: 1, qualityBonusPercent: 0 })
  })
  it('retains the worker lodge art definition without upgrades or a live workforce function', () => {
    const lodge = buildings.find(entry => entry.id === 'chi_hien_quan')!
    expect(lodge.maxLevel).toBe(1)
    expect(lodge.functionType).toBeUndefined()
  })
  it('vendor stays as an art-only max-level building', () => {
    const vendor = buildings.find(entry => entry.id === 'vendor')!
    expect(vendor.maxLevel).toBe(1)
    expect(vendor.functionType).toBeUndefined()
  })
})
