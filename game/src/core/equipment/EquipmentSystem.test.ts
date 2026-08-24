import { describe, expect, it } from 'vitest'
import { EquipmentSystem, calculateEquipmentScale, rollAffixRange } from './EquipmentSystem'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { AffixRegistry } from './AffixRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'
import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import { EQUIPMENT_RARITY_ORDER, EQUIPMENT_RARITY_AFFIX_SLOTS } from './EquipmentRarity'
import { EQUIPMENT_QUALITY_ORDER, EQUIPMENT_QUALITY_MAX_AFFIX_TIER, EQUIPMENT_QUALITY_UNLOCKED_POOLS, EQUIPMENT_QUALITY_MAX_FORGE_POINTS } from './EquipmentQuality'
import { affixes } from '../../data/equipment/affixes'
import { materials } from '../../data/materials/materials'
import { ZoneRegistry } from '../stage/ZoneRegistry'
import { isPercentStat } from '../stats/StatMetadata'

const TEMPLATE: Equipment = {
  id: 'test_sword',
  name: 'Test Sword',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'attack', min: 10, max: 20 }],
  enhanceCost: [{ materialId: 'huyen_thiet', amount: 1 }],
  washCost: [{ materialId: 'huyen_thiet', amount: 1 }],
  refineCost: [{ materialId: 'huyen_thiet', amount: 1 }],
  forgeCost: [{ materialId: 'huyen_thiet', amount: 1 }],
  upgradeQualityCost: [{ materialId: 'huyen_thiet', amount: 1 }],
  addAffixCost: [{ materialId: 'huyen_thiet', amount: 1 }],
  upgradeAffixCost: [{ materialId: 'huyen_thiet', amount: 1 }],
}

const BLACK_IRON = materials.find(m => m.id === 'huyen_thiet')!

describe('equipment stat unit invariants', () => {
  it('roll affix thập phân không bị ép thành 1', () => {
    for (let i = 0; i < 100; i++) {
      const value = rollAffixRange(0.01, 0.09)
      expect(value).toBeGreaterThanOrEqual(0.01)
      expect(value).toBeLessThanOrEqual(0.09)
    }
  })

  it('mọi affix phần trăm dùng cùng đơn vị thập phân 0..1', () => {
    for (const affix of affixes.filter(candidate => isPercentStat(candidate.stat))) {
      for (const tier of affix.tiers) {
        expect(tier.min, affix.id).toBeGreaterThanOrEqual(0)
        expect(tier.max, affix.id).toBeLessThanOrEqual(1)
      }
    }
  })
})

function setup() {
  const system = new EquipmentSystem()
  const bag = new EquipmentBag()
  const registry = new EquipmentRegistry()
  const affixRegistry = new AffixRegistry()
  const slotManager = new EquipmentSlotManager()
  const materialBag = new MaterialBag()
  const player = createDefaultPlayer()

  registry.register(TEMPLATE)

  for (const affix of affixes) {
    affixRegistry.register(affix)
  }

  materialBag.add(BLACK_IRON, 100_000)

  return { system, bag, registry, affixRegistry, slotManager, materialBag, player }
}

// Instance thủ công (không qua createInstance random) — dùng cho test
// cần kiểm soát chính xác quality/rarity/affixes ban đầu.
function manualInstance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    instanceId: 'manual-1',
    itemId: TEMPLATE.id,
    slot: 'weapon',
    equipped: false,
    quality: 'pham_khi',
    rarity: 'hoang',
    realmId: 'qi_refining',
    mainStat: { id: 'roll-main-attack', sourceId: 'roll-main', sourceType: 'equipment', stat: 'attack', flat: 15 },
    affixes: [],
    forgePoints: 0,
    // 100 mặc định = getMaxForgePoints() trả về ĐÚNG BẰNG
    // EQUIPMENT_QUALITY_MAX_FORGE_POINTS[quality] (100% tiềm năng) —
    // giữ nguyên hành vi các test forge() cũ viết trước khi có trục
    // forgePotential (xem EquipmentInstance.ts's ghi chú).
    forgePotential: 100,
    ...overrides,
  }
}

describe('EquipmentSystem.createInstance — roll pipeline invariants (Equipment Rework)', () => {
  it.each([
    ['mortal', 0],
    ['qi_refining', 1],
    ['foundation_establishment', 2],
    ['golden_core', 3],
  ] as const)('không roll Quality cao hơn trần cảnh giới %s', (realmId, maxQualityIndex) => {
    const { system, affixRegistry, player } = setup()
    player.realmId = realmId

    for (let i = 0; i < 100; i++) {
      const instance = system.createInstance(TEMPLATE, player, affixRegistry)
      expect(EQUIPMENT_QUALITY_ORDER.indexOf(instance.quality)).toBeLessThanOrEqual(maxQualityIndex)
    }
  })

  it('Nhẫn dùng range riêng cho từng main stat có thể roll', () => {
    const { system, affixRegistry, player } = setup()
    const template: Equipment = {
      ...TEMPLATE,
      id: 'test_ring_ranges',
      slot: 'ring',
      mainStats: [
        { stat: 'criticalRate', min: 0.01, max: 0.01 },
        { stat: 'criticalDamage', min: 0.5, max: 0.5 },
      ],
    }
    const seen = new Set<string>()

    for (let i = 0; i < 100; i++) {
      const instance = system.createInstance(template, player, affixRegistry)
      seen.add(instance.mainStat.stat)
      const value = instance.mainStat.flat ?? 0

      if (instance.mainStat.stat === 'criticalRate') expect(value).toBeLessThan(0.1)
      if (instance.mainStat.stat === 'criticalDamage') expect(value).toBeGreaterThan(0.1)
    }

    expect(seen).toEqual(new Set(['criticalRate', 'criticalDamage']))
  })

  it('roll và lưu icon từ iconPool trên instance', () => {
    const { system, affixRegistry, player } = setup()
    const instance = system.createInstance({ ...TEMPLATE, iconPool: ['/a.png'] }, player, affixRegistry)
    expect(instance.icon).toBe('/a.png')
  })

  it.each([
    ['ring', 'criticalRate', 0.02, 0.05],
    ['necklace', 'attackSpeed', 0.03, 0.08],
  ] as const)('giữ main stat tỉ lệ khác 0 cho slot %s', (slot, stat, min, max) => {
    const { system, affixRegistry, player } = setup()
    const template: Equipment = {
      ...TEMPLATE,
      id: `test_${slot}`,
      slot,
      mainStats: [{ stat, min, max }],
    }

    for (let i = 0; i < 20; i++) {
      const instance = system.createInstance(template, player, affixRegistry)

      expect(instance.mainStat.flat).toBeGreaterThan(0)
    }
  })

  it('luôn roll rarity trong 5 giá trị hợp lệ, không còn "unique"', () => {
    const { system, affixRegistry, player } = setup()

    for (let i = 0; i < 300; i++) {
      const instance = system.createInstance(TEMPLATE, player, affixRegistry)

      expect(EQUIPMENT_RARITY_ORDER).toContain(instance.rarity)
    }
  })

  it('hoang_pham luôn có 0 affix; số affix không bao giờ vượt rarity cap + 1 (Exalted Affix)', () => {
    const { system, affixRegistry, player } = setup()

    for (let i = 0; i < 300; i++) {
      const instance = system.createInstance(TEMPLATE, player, affixRegistry)

      const cap = EQUIPMENT_RARITY_AFFIX_SLOTS[instance.rarity]

      if (instance.rarity === 'hoang') {
        expect(instance.affixes).toHaveLength(0)
      }

      const maxAllowed = cap.prefix + cap.suffix + (instance.rarity === 'tien' ? 1 : 0)

      expect(instance.affixes.length).toBeLessThanOrEqual(maxAllowed)
      expect(instance.affixes.length).toBeLessThanOrEqual(8) // GLOBAL_MAX_AFFIXES
    }
  })

  it('affix chỉ roll từ pool Quality đã mở khoá (trừ Exalted Affix — luôn được phép supreme)', () => {
    const { system, affixRegistry, player } = setup()

    for (let i = 0; i < 300; i++) {
      const instance = system.createInstance(TEMPLATE, player, affixRegistry)

      const unlockedPools = EQUIPMENT_QUALITY_UNLOCKED_POOLS[instance.quality]

      for (const rolled of instance.affixes) {
        const affix = affixRegistry.get(rolled.affixId)

        const isAllowed = unlockedPools.includes(affix.pool) || (affix.pool === 'supreme' && instance.rarity === 'tien')

        expect(isAllowed).toBe(true)
      }
    }
  })

  it('affix tier không bao giờ vượt trần Quality (riêng Exalted Affix — pool supreme — được phép chạm trần TOÀN HỆ THỐNG, không bị trần Quality của chính item giới hạn, đúng thiết kế "đặc quyền rarity")', () => {
    const { system, affixRegistry, player } = setup()

    const globalMaxTier = EQUIPMENT_QUALITY_MAX_AFFIX_TIER.thien_dia_trong_khi

    for (let i = 0; i < 300; i++) {
      const instance = system.createInstance(TEMPLATE, player, affixRegistry)

      const maxTier = EQUIPMENT_QUALITY_MAX_AFFIX_TIER[instance.quality]

      for (const rolled of instance.affixes) {
        const affix = affixRegistry.get(rolled.affixId)

        const cap = affix.pool === 'supreme' ? globalMaxTier : maxTier

        expect(rolled.tier).toBeLessThanOrEqual(cap)
      }
    }
  })

  it('forgePoints luôn bắt đầu ở 0', () => {
    const { system, affixRegistry, player } = setup()

    const instance = system.createInstance(TEMPLATE, player, affixRegistry)

    expect(instance.forgePoints).toBe(0)
  })
})
describe('EquipmentSystem.forge — deterministic, trần theo Quality', () => {
  it('mỗi lần thành công +1 forgePoints, trừ nguyên liệu', () => {
    const { system, bag, registry, affixRegistry, slotManager, materialBag } = setup()

    const instance = manualInstance({ quality: 'pham_khi' })

    bag.add(instance)

    const before = materialBag.getAmount('huyen_thiet')

    expect(system.forge(instance.instanceId, bag, registry, materialBag, slotManager, affixRegistry)).toBe(true)
    expect(instance.forgePoints).toBe(1)
    expect(materialBag.getAmount('huyen_thiet')).toBeLessThan(before)
  })

  it('bị chặn khi đạt EQUIPMENT_QUALITY_MAX_FORGE_POINTS của quality đó', () => {
    const { system, bag, registry, affixRegistry, slotManager, materialBag } = setup()

    const cap = EQUIPMENT_QUALITY_MAX_FORGE_POINTS.pham_khi

    const instance = manualInstance({ quality: 'pham_khi', forgePoints: cap })

    bag.add(instance)

    expect(system.forge(instance.instanceId, bag, registry, materialBag, slotManager, affixRegistry)).toBe(false)
    expect(instance.forgePoints).toBe(cap)
  })
})

describe('EquipmentSystem.refine — reroll Implicit, KHÔNG đụng affixes/forgePoints', () => {
  it('đổi mainStat.flat, giữ nguyên affixes và forgePoints', () => {
    const { system, bag, registry, affixRegistry, slotManager, materialBag, player } = setup()

    const instance = manualInstance({
      affixes: [{ affixId: 'prefix_attack', tier: 1, value: 5 }],
      forgePoints: 3,
    })

    bag.add(instance)

    const affixesBefore = JSON.stringify(instance.affixes)

    expect(system.refine(instance.instanceId, player, bag, registry, materialBag, slotManager, affixRegistry)).toBe(true)
    expect(JSON.stringify(instance.affixes)).toBe(affixesBefore)
    expect(instance.forgePoints).toBe(3)

    // Range roll của attack (mainStat) với quality pham_khi (x1) + player
    // mặc định (pham_nhan lv1, globalLevel=1 — vẫn 1 vì pham_nhan là
    // REALMS[0], xem data/realms/realm.ts) — chặn trong khoảng hợp lý,
    // không cần khớp giá trị cụ thể (random).
    expect(instance.mainStat.flat).toBeGreaterThan(0)
  })

  it('từ chối main stat không thuộc template mà không trừ nguyên liệu', () => {
    const { system, bag, registry, affixRegistry, slotManager, materialBag, player } = setup()
    const instance = manualInstance({
      mainStat: { id: 'bad', sourceId: 'bad', sourceType: 'equipment', stat: 'defense', flat: 15 },
    })
    bag.add(instance)
    const before = materialBag.getAmount('huyen_thiet')

    expect(system.refine(instance.instanceId, player, bag, registry, materialBag, slotManager, affixRegistry)).toBe(false)
    expect(materialBag.getAmount('huyen_thiet')).toBe(before)
    expect(instance.mainStat.stat).toBe('defense')
  })

  it('cập nhật realmLevel nhưng không làm equipment tụt progression', () => {
    const { system, bag, registry, affixRegistry, slotManager, materialBag, player } = setup()
    const instance = manualInstance({ realmId: 'qi_refining', realmLevel: 2 })
    bag.add(instance)
    player.realmId = 'qi_refining'
    player.realmLevel = 6

    expect(system.refine(instance.instanceId, player, bag, registry, materialBag, slotManager, affixRegistry)).toBe(true)
    expect(instance.realmId).toBe('qi_refining')
    expect(instance.realmLevel).toBe(6)

    player.realmLevel = 3
    expect(system.refine(instance.instanceId, player, bag, registry, materialBag, slotManager, affixRegistry)).toBe(true)
    expect(instance.realmLevel).toBe(6)
  })
})

describe('EquipmentSystem.upgradeRealm — atomic realm metadata', () => {
  it('cập nhật cả realmId và realmLevel khi nâng thành công', () => {
    const { system, bag, registry, affixRegistry, slotManager, materialBag, player } = setup()
    const instance = manualInstance({ realmId: 'mortal', realmLevel: 5 })
    bag.add(instance)
    player.realmId = 'qi_refining'
    player.realmLevel = 7

    expect(system.upgradeRealm(instance.instanceId, player, bag, registry, materialBag, slotManager, affixRegistry)).toBe(true)
    expect(instance.realmId).toBe('qi_refining')
    expect(instance.realmLevel).toBe(7)
  })

  it('không trừ tài nguyên khi retained stat không hợp lệ', () => {
    const { system, bag, registry, affixRegistry, slotManager, materialBag, player } = setup()
    const instance = manualInstance({
      realmId: 'mortal',
      mainStat: { id: 'bad', sourceId: 'bad', sourceType: 'equipment', stat: 'defense', flat: 10 },
    })
    bag.add(instance)
    player.realmId = 'qi_refining'
    player.spiritStone = 100
    const stonesBefore = player.spiritStone
    const materialBefore = materialBag.getAmount('huyen_thiet')

    expect(system.upgradeRealm(instance.instanceId, player, bag, registry, materialBag, slotManager, affixRegistry)).toBe(false)
    expect(player.spiritStone).toBe(stonesBefore)
    expect(materialBag.getAmount('huyen_thiet')).toBe(materialBefore)
  })
})

describe('EquipmentSystem.wash — reroll giá trị Affix, KHÔNG đụng mainStat', () => {
  it('đổi value của affix hiện có, giữ nguyên affixId/tier và mainStat', () => {
    const { system, bag, registry, affixRegistry, slotManager, materialBag } = setup()

    const instance = manualInstance({
      affixes: [{ affixId: 'prefix_attack', tier: 3, value: 13 }],
    })

    bag.add(instance)

    const mainStatBefore = instance.mainStat.flat

    expect(system.wash(instance.instanceId, bag, registry, materialBag, slotManager, affixRegistry)).toBe(true)
    expect(instance.affixes[0]!.affixId).toBe('prefix_attack')
    expect(instance.affixes[0]!.tier).toBe(3)
    expect(instance.affixes[0]!.value).toBeGreaterThanOrEqual(13)
    expect(instance.affixes[0]!.value).toBeLessThanOrEqual(20)
    expect(instance.mainStat.flat).toBe(mainStatBefore)
  })

  it('không làm gì nếu instance chưa có affix nào', () => {
    const { system, bag, registry, affixRegistry, slotManager, materialBag } = setup()

    const instance = manualInstance({ affixes: [] })

    bag.add(instance)

    expect(system.wash(instance.instanceId, bag, registry, materialBag, slotManager, affixRegistry)).toBe(false)
  })
})

describe('calculateEquipmentScale', () => {
  it('cộng dồn enhanceLevel và forgePoints vào hệ số nhân', () => {
    expect(calculateEquipmentScale(0, 0)).toBe(1)
    expect(calculateEquipmentScale(10, 0)).toBeCloseTo(1.8, 5)
    expect(calculateEquipmentScale(0, 100)).toBeCloseTo(1.5, 5)
  })
})

describe('EquipmentSystem.createInstance — zoneId (Địa Giới ghép động)', () => {
  it('stamp đúng zoneId truyền vào; không truyền = undefined', () => {
    const { system, affixRegistry, player } = setup()

    const withZone = system.createInstance(TEMPLATE, player, affixRegistry, 'qi_refining_valley')
    expect(withZone.zoneId).toBe('qi_refining_valley')

    const withoutZone = system.createInstance(TEMPLATE, player, affixRegistry)
    expect(withoutZone.zoneId).toBeUndefined()
  })
})
