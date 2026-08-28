import { describe, expect, it } from 'vitest'
import { BuildingSystem } from './BuildingSystem'
import type { Building } from './Building'
import type { BuildingInstance } from './BuildingInstance'
import { BuildingRegistry } from './BuildingRegistry'
import { BuildingManager } from './BuildingManager'
import { MaterialBag } from '../material/MaterialBag'

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
      equipmentCostDiscountPercent: 0,
    })
  })

  it('level 1 (chưa đạt level nào có effect) — vẫn 1 slot mặc định', () => {
    expect(system.getCraftModifiers(instanceAt(1), TEMPLATE)).toEqual({
      timeReductionPercent: 0,
      qualityBonusPercent: 0,
      concurrentJobSlots: 1,
      equipmentCostDiscountPercent: 0,
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

describe('BuildingSystem.upgrade realm tier gate', () => {
  it('không cho cấp building vượt tier cảnh giới hiện tại', () => {
    const registry = new BuildingRegistry()
    const manager = new BuildingManager()
    const bag = new MaterialBag()
    registry.register({ ...TEMPLATE, maxLevel: 9, upgradeCost: Array.from({ length: 9 }, () => []) })
    manager.add(instanceAt(1))

    expect(system.upgrade('i1', registry, manager, bag, 'mortal')).toBe(false)
    expect(system.upgrade('i1', registry, manager, bag, 'qi_refining')).toBe(true)
    expect(manager.get('i1')?.level).toBe(2)
  })
})

describe('BuildingSystem Linh Tuyền (engine offline, balance 2026-08-28)', () => {
  function spring(): Building {
    return {
      ...TEMPLATE,
      id: 'spirit_spring',
      producesMaterialId: 'spirit_stone',
      baseProductionRate: 5.5 / 60 / 2.6,
      maxLevel: 9,
    }
  }

  function springInstance(level: number): BuildingInstance {
    return { ...instanceAt(level), buildingId: 'spirit_spring' }
  }

  it('rate level MAX = 5% rate farm online của realm (thạch/phút)', () => {
    const s = spring()

    expect(system.getRatePerMinute(springInstance(9), s, 'mortal')).toBeCloseTo(5.5, 5)
    expect(system.getRatePerMinute(springInstance(9), s, 'qi_refining')).toBeCloseTo(31, 5)
    expect(system.getRatePerMinute(springInstance(9), s, 'foundation_establishment')).toBeCloseTo(93, 5)
  })

  it('realm cao hơn rate cao hơn; L1 < L9', () => {
    const s = spring()

    const mortalL1 = system.getRatePerMinute(springInstance(1), s, 'mortal')
    const mortalL9 = system.getRatePerMinute(springInstance(9), s, 'mortal')
    const qiL9 = system.getRatePerMinute(springInstance(9), s, 'qi_refining')
    const foundationL9 = system.getRatePerMinute(springInstance(9), s, 'foundation_establishment')

    expect(mortalL9).toBeGreaterThan(mortalL1)
    expect(qiL9).toBeGreaterThan(mortalL9)
    expect(foundationL9).toBeGreaterThan(qiL9)
  })

  it('storage = đúng 10h sản lượng ở level/realm đó', () => {
    const s = spring()
    const instance = springInstance(9)

    // 10h = 600 phút → capacity ≈ rate/phút × 600
    const ratePerMinute = system.getRatePerMinute(instance, s, 'qi_refining')
    expect(system.getCapacity(instance, s, 'qi_refining')).toBeCloseTo(ratePerMinute * 600, 0)
  })

  it('getStoredAmount chạm trần storage sau đúng 10h offline', () => {
    const s = spring()
    const instance = { ...springInstance(9), lastCollectedAt: 0 }

    const stored = system.getStoredAmount(instance, s, 36_000, 'qi_refining')
    const capacity = system.getCapacity(instance, s, 'qi_refining')

    expect(stored).toBe(capacity)
  })

  it('storage tăng theo realm (foundation > qi > mortal)', () => {
    const s = spring()

    const m = system.getCapacity(springInstance(9), s, 'mortal')
    const q = system.getCapacity(springInstance(9), s, 'qi_refining')
    const f = system.getCapacity(springInstance(9), s, 'foundation_establishment')

    expect(f).toBeGreaterThan(q)
    expect(q).toBeGreaterThan(m)
  })
})
