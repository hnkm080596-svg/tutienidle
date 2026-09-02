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
  name: 'Äan PhÃ²ng',
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

describe('BuildingSystem.getCraftModifiers (BUILDing spec má»¥c 15-16)', () => {
  it('tráº£ vá» default (1 slot, khÃ´ng bonus) cho building khÃ´ng cÃ³ `levels`', () => {
    const noLevels: Building = { ...TEMPLATE, levels: undefined }

    expect(system.getCraftModifiers(instanceAt(5), noLevels)).toEqual({
      timeReductionPercent: 0,
      qualityBonusPercent: 0,
      concurrentJobSlots: 1,
      equipmentCostDiscountPercent: 0,
    })
  })

  it('level 1 (chÆ°a Ä‘áº¡t level nÃ o cÃ³ effect) â€” váº«n 1 slot máº·c Ä‘á»‹nh', () => {
    expect(system.getCraftModifiers(instanceAt(1), TEMPLATE)).toEqual({
      timeReductionPercent: 0,
      qualityBonusPercent: 0,
      concurrentJobSlots: 1,
      equipmentCostDiscountPercent: 0,
    })
  })

  it('cá»™ng dá»“n Má»ŒI level Ä‘Ã£ Ä‘áº¡t, khÃ´ng chá»‰ level hiá»‡n táº¡i', () => {
    const modifiers = system.getCraftModifiers(instanceAt(3), TEMPLATE)

    expect(modifiers.qualityBonusPercent).toBe(5)
    expect(modifiers.timeReductionPercent).toBe(15)
  })

  it('cá»™ng dá»“n effect cÃ¹ng loáº¡i á»Ÿ cÃ¡c má»‘c khÃ¡c nhau', () => {
    const atLevel4 = system.getCraftModifiers(instanceAt(4), TEMPLATE)

    expect(atLevel4.qualityBonusPercent).toBe(10)

    const atLevel5 = system.getCraftModifiers(instanceAt(5), TEMPLATE)

    expect(atLevel5.timeReductionPercent).toBe(25)
  })

  it('khÃ´ng tÃ­nh effect cá»§a level chÆ°a Ä‘áº¡t', () => {
    const modifiers = system.getCraftModifiers(instanceAt(2), TEMPLATE)

    expect(modifiers.qualityBonusPercent).toBe(5)
    expect(modifiers.timeReductionPercent).toBe(0)
    expect(modifiers.concurrentJobSlots).toBe(1)
  })
})

describe('BuildingSystem.upgrade realm tier gate', () => {
  it('khÃ´ng cho cáº¥p building vÆ°á»£t tier cáº£nh giá»›i hiá»‡n táº¡i', () => {
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

describe('BuildingSystem Linh Tuyá»n (engine offline, balance 2026-08-28)', () => {
  function spring(): Building {
    return {
      ...TEMPLATE,
      id: 'gathering_outpost',
      producesMaterialId: 'spirit_stone',
      baseProductionRate: 5.5 / 60 / 2.6,
      maxLevel: 9,
    }
  }

  function springInstance(level: number): BuildingInstance {
    return { ...instanceAt(level), buildingId: 'gathering_outpost' }
  }

  it('rate level MAX = 5% rate farm online cá»§a realm (tháº¡ch/phÃºt)', () => {
    const s = spring()

    expect(system.getRatePerMinute(springInstance(9), s, 'mortal')).toBeCloseTo(5.5, 5)
    expect(system.getRatePerMinute(springInstance(9), s, 'qi_refining')).toBeCloseTo(31, 5)
    expect(system.getRatePerMinute(springInstance(9), s, 'foundation_establishment')).toBeCloseTo(93, 5)
  })

  it('realm cao hÆ¡n rate cao hÆ¡n; L1 < L9', () => {
    const s = spring()

    const mortalL1 = system.getRatePerMinute(springInstance(1), s, 'mortal')
    const mortalL9 = system.getRatePerMinute(springInstance(9), s, 'mortal')
    const qiL9 = system.getRatePerMinute(springInstance(9), s, 'qi_refining')
    const foundationL9 = system.getRatePerMinute(springInstance(9), s, 'foundation_establishment')

    expect(mortalL9).toBeGreaterThan(mortalL1)
    expect(qiL9).toBeGreaterThan(mortalL9)
    expect(foundationL9).toBeGreaterThan(qiL9)
  })

  it('storage = Ä‘Ãºng 10h sáº£n lÆ°á»£ng á»Ÿ level/realm Ä‘Ã³', () => {
    const s = spring()
    const instance = springInstance(9)

    // 10h = 600 phÃºt â†’ capacity â‰ˆ rate/phÃºt Ã— 600
    const ratePerMinute = system.getRatePerMinute(instance, s, 'qi_refining')
    expect(system.getCapacity(instance, s, 'qi_refining')).toBeCloseTo(ratePerMinute * 600, 0)
  })

  it('getStoredAmount cháº¡m tráº§n storage sau Ä‘Ãºng 10h offline', () => {
    const s = spring()
    const instance = { ...springInstance(9), lastCollectedAt: 0 }

    const stored = system.getStoredAmount(instance, s, 36_000, 'qi_refining')
    const capacity = system.getCapacity(instance, s, 'qi_refining')

    expect(stored).toBe(capacity)
  })

  it('storage tÄƒng theo realm (foundation > qi > mortal)', () => {
    const s = spring()

    const m = system.getCapacity(springInstance(9), s, 'mortal')
    const q = system.getCapacity(springInstance(9), s, 'qi_refining')
    const f = system.getCapacity(springInstance(9), s, 'foundation_establishment')

    expect(f).toBeGreaterThan(q)
    expect(q).toBeGreaterThan(m)
  })

  it('claim giá»¯ PHáº¦N Láºº: 2 láº§n claim liÃªn tiáº¿p nháº­n Ä‘Ãºng tá»•ng sáº£n lÆ°á»£ng (review 2026-08-28)', () => {
    const s = spring()
    const registry = new BuildingRegistry()
    const manager = new BuildingManager()

    registry.register(s)

    const instance = { ...springInstance(1), lastCollectedAt: 0 }

    manager.add(instance)

    // Rate L1 mortal â‰ˆ 0.03526/s â†’ 100s tÃ­ch â‰ˆ 3.53 (3 nguyÃªn + 0.53 láº»).
    const first = system.claim('i1', registry, manager, 100, 'mortal')

    expect(first.amount).toBe(3)

    // Pháº§n láº» Ä‘Æ°á»£c giá»¯: má»‘c lÃ¹i vá» quÃ¡ khá»©, KHÃ”NG reset vá» currentTime.
    expect(manager.get('i1')!.lastCollectedAt).toBeLessThan(100)
    expect(manager.get('i1')!.lastCollectedAt).toBeGreaterThan(0)

    // Claim láº§n 2 á»Ÿ t=200: nháº­n cáº£ pháº§n láº» cÅ© â†’ tá»•ng 2 láº§n = floor(200 Ã— rate) = 7.
    const second = system.claim('i1', registry, manager, 200, 'mortal')

    expect(second.amount).toBe(4)
    expect(first.amount + second.amount).toBe(7)
  })

  it('claim chÆ°a Ä‘á»§ 1 Ä‘Æ¡n vá»‹ â†’ tráº£ 0 vÃ  KHÃ”NG reset má»‘c', () => {
    const s = spring()
    const registry = new BuildingRegistry()
    const manager = new BuildingManager()

    registry.register(s)

    const instance = { ...springInstance(1), lastCollectedAt: 0 }

    manager.add(instance)

    // 10s Ã— 0.035 â‰ˆ 0.35 < 1 â†’ chÆ°a claim Ä‘Æ°á»£c.
    const result = system.claim('i1', registry, manager, 10, 'mortal')

    expect(result.amount).toBe(0)
    expect(manager.get('i1')!.lastCollectedAt).toBe(0)
  })
})
