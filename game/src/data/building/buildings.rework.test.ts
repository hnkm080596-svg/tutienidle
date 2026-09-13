import { describe, expect, it } from 'vitest'
import { buildings } from './buildings'
import { BuildingSystem } from '@/core/building/BuildingSystem'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'

const buildingSystem = new BuildingSystem()

describe('building 9-tier scaffold', () => {
  it('giữ ID gathering_outpost nhưng dùng tên hiển thị Khai Vật Đường', () => {
    expect(buildings.find(entry => entry.id === 'gathering_outpost')?.name).toBe('Khai Vật Đường')
  })

  it.each(['chi_hien_quan', 'equipment_hall', 'pill_room', 'gathering_outpost'])('%s có đủ 9 cấp và 9 cost bands', (id) => {
    const building = buildings.find(entry => entry.id === id)!
    expect(building.maxLevel).toBe(9)
    expect(building.upgradeCost).toHaveLength(9)
  })

  it('cấp Kim Đan+ dùng Linh Mộc/Linh Khoáng phân phẩm (linh mạch Khai Vật Đường)', () => {
    const outpost = buildings.find(entry => entry.id === 'gathering_outpost')!
    expect(outpost.upgradeCost[3]?.map(cost => cost.materialId)).toEqual([
      'golden_core_wood_century', 'golden_core_ore_century',
    ])
  })
})

// Chiêu Hiền Quán (2026-09-02, spec 2026-09-02-chi-hien-quan-design.md)
describe('chi_hien_quan + linh mạch Khai Vật Đường', () => {
  it('chi_hien_quan tồn tại — maxLevel 9 + 9 cost bands + functionType worker_lodge', () => {
    const chq = buildings.find((entry) => entry.id === 'chi_hien_quan')!

    expect(chq.maxLevel).toBe(9)
    expect(chq.upgradeCost).toHaveLength(9)
    expect(chq.functionType).toBe('worker_lodge')
  })

  it('spirit_spring đã bị XÓA khỏi buildings data', () => {
    expect(buildings.find((entry) => entry.id === 'spirit_spring')).toBeUndefined()
  })

  it('gathering_outpost mang linh mạch (producesMaterialId Linh Thạch) nhưng KHÔNG còn workersPerLevel', () => {
    const outpost = buildings.find((entry) => entry.id === 'gathering_outpost')!

    expect(outpost.producesMaterialId).toBe(SPIRIT_STONE_MATERIAL_ID)
    expect(outpost.workersPerLevel).toBeUndefined()
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
