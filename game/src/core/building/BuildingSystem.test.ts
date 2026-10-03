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

describe('BuildingSystem.quoteUpgrade (single owner for header/upgrade rules)', () => {
  const COST_TEMPLATE: Building = {
    ...TEMPLATE,
    maxLevel: 5,
    upgradeCost: [
      [],
      [{ materialId: 'mortal_wood_decade', amount: 4 }],
      [{ materialId: 'mortal_wood_decade', amount: 6 }],
      [],
    ],
  }

  function setup(level = 1) {
    const registry = new BuildingRegistry()
    const manager = new BuildingManager()
    const bag = new MaterialBag()
    registry.register(COST_TEMPLATE)
    manager.add(instanceAt(level))

    return { registry, manager, bag }
  }

  it('capped level → hasNextLevel:false', () => {
    const { registry, manager, bag } = setup(5)

    const quote = system.quoteUpgrade('i1', registry, manager, bag, 'mortal')

    expect(quote?.hasNextLevel).toBe(false)
    expect(quote?.nextUpgradeCost).toEqual([])
  })

  it('realm-gated next level → meetsRealmRequirement:false', () => {
    const { registry, manager, bag } = setup(2)

    const quote = system.quoteUpgrade('i1', registry, manager, bag, 'qi_refining')

    expect(quote?.hasNextLevel).toBe(true)
    expect(quote?.meetsRealmRequirement).toBe(false)
    expect(quote?.requiredRealmId).toBe('foundation_establishment')
  })

  it('insufficient materials → canAfford:false', () => {
    const { registry, manager, bag } = setup(1)

    const quote = system.quoteUpgrade('i1', registry, manager, bag, 'qi_refining')

    expect(quote?.nextUpgradeCost).toEqual([{ materialId: 'mortal_wood_decade', amount: 4 }])
    expect(quote?.canAfford).toBe(false)
  })

  it('happy path — exact upgradeCost[level] entry, affordable', () => {
    const { registry, manager, bag } = setup(1)
    bag.add({ id: 'mortal_wood_decade', name: 'Gỗ', category: 'wood', sourceType: 'exploration' }, 4)

    const quote = system.quoteUpgrade('i1', registry, manager, bag, 'qi_refining')

    expect(quote).toMatchObject({
      hasNextLevel: true,
      meetsRealmRequirement: true,
      requiredRealmId: 'qi_refining',
      nextUpgradeCost: [{ materialId: 'mortal_wood_decade', amount: 4 }],
      canAfford: true,
    })
  })

  it('unknown instance → null', () => {
    const { registry, manager, bag } = setup(1)

    expect(system.quoteUpgrade('missing', registry, manager, bag, 'mortal')).toBeNull()
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

    // 10h = 600 phut -> capacity ~ rate/phut x 600
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

    // Rate L1 mortal ~ 0.03526/s -> 100s tich ~ 3.53 (3 nguyen + 0.53 le).
    const first = system.claim('i1', registry, manager, 100, 'mortal')

    expect(first.amount).toBe(3)

    // Phan le duoc giu: moc lui ve qua khu, KHONG reset ve currentTime.
    expect(manager.get('i1')!.lastCollectedAt).toBeLessThan(100)
    expect(manager.get('i1')!.lastCollectedAt).toBeGreaterThan(0)

    // Claim lan 2 o t=200: nhan ca phan le cu -> tong 2 lan = floor(200 x rate) = 7.
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

    // 10s x 0.035 ~ 0.35 < 1 -> chua claim duoc.
    const result = system.claim('i1', registry, manager, 10, 'mortal')

    expect(result.amount).toBe(0)
    expect(manager.get('i1')!.lastCollectedAt).toBe(0)
  })

  // EM-01 - dot pha giua cua so tich luy KHONG reprice nguoc backlog:
  // claim tra theo realm cua cua so (accrualRealmId), roi pin chuyen
  // sang realm hien tai cho cua so ke tiep.
  it('claim sau dot pha tra theo realm cua cua so tich luy, khong phai realm luc claim', () => {
    const s = spring()
    const registry = new BuildingRegistry()
    const manager = new BuildingManager()
    registry.register(s)

    // Cua so accrue o mortal L9 (~0.0917/s); player len qi_refining giua chung.
    const instance: BuildingInstance = {
      ...springInstance(9),
      lastCollectedAt: 0,
      accrualRealmId: 'mortal',
    }
    manager.add(instance)

    const first = system.claim('i1', registry, manager, 100, 'qi_refining')

    // 100s x 0.0917 ~ 9.17 -> 9; reprice qi_refining (~0.517/s) se la 51.
    expect(first.amount).toBe(9)
    expect(manager.get('i1')!.accrualRealmId).toBe('qi_refining')

    // Cua so ke tiep accrue o realm moi.
    const second = system.claim('i1', registry, manager, 200, 'qi_refining')
    expect(second.amount).toBeGreaterThan(9)
  })

  it('instance khong co accrualRealmId (save cu) -> fallback realm hien tai, hanh vi cu', () => {
    const s = spring()
    const registry = new BuildingRegistry()
    const manager = new BuildingManager()
    registry.register(s)

    const instance = { ...springInstance(9), lastCollectedAt: 0 }
    manager.add(instance)

    const result = system.claim('i1', registry, manager, 100, 'qi_refining')

    // Khong pin -> gia claim-time realm: 100s x 0.517 ~ 51.7 -> 51.
    expect(result.amount).toBe(51)
    expect(manager.get('i1')!.accrualRealmId).toBe('qi_refining')
  })

  it('build moi pin accrualRealmId = realm luc xay', () => {
    const registry = new BuildingRegistry()
    const manager = new BuildingManager()
    const bag = new MaterialBag()
    registry.register({ ...spring(), upgradeCost: [[]] })

    const player = { realmId: 'mortal' } as never
    const built = system.build('gathering_outpost', registry, manager, player, bag, 1_000)

    expect(built?.accrualRealmId).toBe('mortal')
  })
})
