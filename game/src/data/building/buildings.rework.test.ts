import { describe, expect, it } from 'vitest'
import { buildings } from './buildings'
import { BuildingSystem } from '@/core/building/BuildingSystem'

const buildingSystem = new BuildingSystem()

describe('building 9-tier scaffold', () => {
  it.each(['spirit_spring', 'equipment_hall', 'pill_room', 'gathering_outpost'])('%s có đủ 9 cấp và 9 cost bands', (id) => {
    const building = buildings.find(entry => entry.id === id)!
    expect(building.maxLevel).toBe(9)
    expect(building.upgradeCost).toHaveLength(9)
  })

  it('cấp Kim Đan+ dùng Linh Mộc/Linh Khoáng phân phẩm', () => {
    const spring = buildings.find(entry => entry.id === 'spirit_spring')!
    expect(spring.upgradeCost[3]?.map(cost => cost.materialId)).toEqual([
      'golden_core_wood_huyen', 'golden_core_ore_huyen',
    ])
  })
})

describe('W5 — building level effects mới', () => {
  it('Khí Đường level 9 giảm 24% chi phí equipment', () => {
    const hall = buildings.find(entry => entry.id === 'equipment_hall')!

    const modifiers = buildingSystem.getCraftModifiers(
      { instanceId: 'hall', buildingId: 'equipment_hall', level: 9, lastCollectedAt: 0 },
      hall,
    )

    expect(modifiers.equipmentCostDiscountPercent).toBe(24)
  })

  it('Đan Phòng level 9 có 4 slot luyện đan đồng thời', () => {
    const room = buildings.find(entry => entry.id === 'pill_room')!

    const modifiers = buildingSystem.getCraftModifiers(
      { instanceId: 'room', buildingId: 'pill_room', level: 9, lastCollectedAt: 0 },
      room,
    )

    expect(modifiers.concurrentJobSlots).toBe(4)
  })
})
