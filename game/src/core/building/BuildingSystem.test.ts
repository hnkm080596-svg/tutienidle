import { describe, expect, it } from 'vitest'
import { BuildingSystem } from './BuildingSystem'
import type { Building } from './Building'
import type { BuildingInstance } from './BuildingInstance'

const system = new BuildingSystem()

function instanceAt(level: number): BuildingInstance {
  return { instanceId: 'i1', buildingId: 'pill_room', level, lastCollectedAt: 0 }
}

const TEMPLATE: Building = {
  id: 'pill_room',
  name: 'Đan Phòng',
  category: 'crafting_station',
  tier: 1,
  maxLevel: 5,
  baseStorageCapacity: 0,
  upgradeCost: [[], [], [], []],
  functionType: 'pill_room',
  levels: [
    { level: 2, effects: [{ kind: 'craft_quality_bonus', percent: 5 }] },
    { level: 3, effects: [{ kind: 'craft_time_reduction', percent: 15 }] },
    { level: 4, effects: [{ kind: 'craft_quality_bonus', percent: 5 }] },
    { level: 5, effects: [{ kind: 'craft_time_reduction', percent: 10 }] },
  ],
}

describe('BuildingSystem.getCraftModifiers (BUILDing spec mục 15-16)', () => {
  it('trả về default (1 slot, không bonus) cho building không có `levels`', () => {
    const noLevels: Building = { ...TEMPLATE, levels: undefined }

    expect(system.getCraftModifiers(instanceAt(5), noLevels)).toEqual({
      timeReductionPercent: 0,
      qualityBonusPercent: 0,
      concurrentJobSlots: 1,
    })
  })

  it('level 1 (chưa đạt level nào có effect) — vẫn 1 slot mặc định', () => {
    expect(system.getCraftModifiers(instanceAt(1), TEMPLATE)).toEqual({
      timeReductionPercent: 0,
      qualityBonusPercent: 0,
      concurrentJobSlots: 1,
    })
  })

  it('cộng dồn MỌI level đã đạt, không chỉ level hiện tại', () => {
    const modifiers = system.getCraftModifiers(instanceAt(3), TEMPLATE)

    expect(modifiers.qualityBonusPercent).toBe(5)
    expect(modifiers.timeReductionPercent).toBe(15)
  })

  it('cộng dồn effect cùng loại ở các mốc khác nhau', () => {
    const atLevel4 = system.getCraftModifiers(instanceAt(4), TEMPLATE)

    expect(atLevel4.qualityBonusPercent).toBe(10)

    const atLevel5 = system.getCraftModifiers(instanceAt(5), TEMPLATE)

    expect(atLevel5.timeReductionPercent).toBe(25)
  })

  it('không tính effect của level chưa đạt', () => {
    const modifiers = system.getCraftModifiers(instanceAt(2), TEMPLATE)

    expect(modifiers.qualityBonusPercent).toBe(5)
    expect(modifiers.timeReductionPercent).toBe(0)
    expect(modifiers.concurrentJobSlots).toBe(1)
  })
})
