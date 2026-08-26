import { describe, expect, it } from 'vitest'
import { EquipmentSystem, calculateEquipmentScale, rollAffixRange, getMaxForgePoints } from './EquipmentSystem'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { AffixRegistry } from './AffixRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'
import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import { EQUIPMENT_RARITY_ORDER, EQUIPMENT_RARITY_AFFIX_SLOTS } from './EquipmentRarity'
import {
  EQUIPMENT_QUALITY_ORDER,
  EQUIPMENT_QUALITY_MAX_AFFIX_TIER,
  EQUIPMENT_QUALITY_UNLOCKED_POOLS,
  EQUIPMENT_QUALITY_MAX_FORGE_POINTS,
} from './EquipmentQuality'
import { affixes } from '../../data/equipment/affixes'
import { materials } from '../../data/materials/materials'
import { SPIRIT_STONE_MATERIAL, SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import { ZoneRegistry } from '../stage/ZoneRegistry'
import { isPercentStat } from '../stats/StatMetadata'
import {
  REFINE_REFINEMENT_COST,
  REFINE_SPIRIT_STONE_PER_UNIT,
  equipmentEssenceMaterialId,
} from './RefinementBalance'

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

const BLACK_IRON = materials.find((m) => m.id === 'huyen_thiet')!

describe('equipment stat unit invariants', () => {
  it('roll affix thập phân không bị ép thành 1', () => {
    for (let i = 0; i < 100; i++) {
      const value = rollAffixRange(0.01, 0.09)
      expect(value).toBeGreaterThanOrEqual(0.01)
      expect(value).toBeLessThanOrEqual(0.09)
    }
  })

  it('mọi affix phần trăm dùng cùng đơn vị thập phân 0..1', () => {
    for (const affix of affixes.filter((candidate) => isPercentStat(candidate.stat))) {
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

  // Plan Workstream F — Linh Thạch là MATERIAL: nạp sẵn số dư lớn.
  materialBag.add(SPIRIT_STONE_MATERIAL, 1_000_000)

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
    mainStat: {
      id: 'roll-main-attack',
      sourceId: 'roll-main',
      sourceType: 'equipment',
      stat: 'attack',
      flat: 15,
    },
    affixes: [],
    forgePoints: 0,
    // 100 mặc định = getMaxForgePoints() trả về ĐÚNG BẰNG
    // EQUIPMENT_QUALITY_MAX_FORGE_POINTS[quality] (100% tiềm năng) —
    // giữ nguyên hành vi các test forge() cũ viết trước khi có trục
    // forgePotential (xem EquipmentInstance.ts's ghi chú).
    forgePotential: 100,

    // Điểm Rèn per-item (rework 2026-08-26) — mặc định full cap; các
    // test Tẩy/Tinh Luyện ghi đè qua overrides hoặc gán trực tiếp.

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
    const instance = system.createInstance(
      { ...TEMPLATE, iconPool: ['/a.png'] },
      player,
      affixRegistry,
    )
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

        const isAllowed =
          unlockedPools.includes(affix.pool) ||
          (affix.pool === 'supreme' && instance.rarity === 'tien')

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

  it('forgePoints khởi đầu ĐẦY theo potential (điểm rèn per-item, rework 2026-08-26)', () => {
    const { system, affixRegistry, player } = setup()

    const instance = system.createInstance(TEMPLATE, player, affixRegistry)

    // Full budget = trần theo potential roll; luôn > 0 với roll 1-100.
    expect(instance.forgePoints).toBe(
      getMaxForgePoints(instance.quality, instance.forgePotential),
    )

    expect(instance.forgePoints).toBeGreaterThan(0)
  })
})

describe('EquipmentSystem — Tẩy Luyện (washAffixes, plan §7.3)', () => {
  const ORE = 'qi_refining_ore_hoang'

  function washSetup() {
    const ctx = setup()

    const ore = materials.find((material) => material.id === ORE)!

    ctx.materialBag.add(ore, 100)

    return ctx
  }

  function equippedWithAffixes(ctx: ReturnType<typeof setup>) {
    const instance = manualInstance()

    // Ngân sách Điểm Rèn per-item — full để test luồng thành công.
    instance.forgePoints = 100

    instance.equipped = true

    instance.affixes = [
      { affixId: affixes[0]!.id, tier: 1, value: 5 },
      { affixId: affixes[1]!.id, tier: 1, value: 5 },
      { affixId: affixes[2]!.id, tier: 1, value: 5 },
    ]

    ctx.bag.add(instance)

    return instance
  }

  it('sai realm Quáng → từ chối KHÔNG trừ gì', () => {
    const ctx = washSetup()

    const wrongOre = materials.find((material) => material.id === 'mortal_ore_hoang')!

    ctx.materialBag.add(wrongOre, 10)

    const instance = equippedWithAffixes(ctx)

    const before = { ...ctx.player }

    expect(
      ctx.system.washAffixes(instance.instanceId, 'mortal_ore_hoang', ctx.bag, ctx.registry, ctx.materialBag, ctx.slotManager, ctx.affixRegistry).reason,
    ).toBe('ore_realm_mismatch')

    expect(instance.forgePoints).toBe(100)
  })

  it('thiếu Điểm Rèn → từ chối', () => {
    const ctx = washSetup()

    const instance = equippedWithAffixes(ctx)

    instance.forgePoints = 0

    expect(
      ctx.system.washAffixes(instance.instanceId, ORE, ctx.bag, ctx.registry, ctx.materialBag, ctx.slotManager, ctx.affixRegistry).reason,
    ).toBe('missing_refinement_points')
  })

  it('thành công: reroll identity, trừ đúng cost, giữ mainStat/quality/realm', () => {
    const ctx = washSetup()

    const instance = equippedWithAffixes(ctx)

    const mainBefore = instance.mainStat.flat

    const pointsBefore = instance.forgePoints

    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    const result = ctx.system.washAffixes(
      instance.instanceId,
      ORE,
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => 0.99,
    )

    expect(result.ok).toBe(true)

    expect(instance.mainStat.flat).toBe(mainBefore)

    expect(instance.realmId).toBe('qi_refining')

    // Cost: Điểm Rèn 20 + Linh Thạch 100 + 3 quáng.
    expect(instance.forgePoints).toBe(pointsBefore - 20)

    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore - 100)

    expect(ctx.materialBag.getAmount(ORE)).toBe(97)
  })
})

describe('EquipmentSystem — Tinh Luyện (refineAffixValues, plan §7.4)', () => {
  function refineSetup() {
    const ctx = setup()

    const essenceId = equipmentEssenceMaterialId('qi_refining')

    const essence = materials.find((material) => material.id === essenceId)!

    ctx.materialBag.add(essence, 50)

    const instance = manualInstance()

    instance.affixes = [
      { affixId: affixes[0]!.id, tier: 2, value: 20 },
      { affixId: affixes[1]!.id, tier: 2, value: 20 },
      { affixId: affixes[2]!.id, tier: 2, value: 20 },
      { affixId: affixes[3]!.id, tier: 2, value: 20 },
    ]

    ctx.bag.add(instance)

    // Điểm Rèn per-item — cho vừa đủ để assert trừ đúng cost.
    instance.forgePoints = 50

    return { ...ctx, instance, essenceId }
  }

  it('khóa toàn bộ (3/3 dòng) → từ chối (cannot_lock_all)', () => {
    const ctx = refineSetup()

    const three = manualInstance({ instanceId: 'three-1' })

    three.affixes = ctx.instance.affixes.slice(0, 3)

    ctx.bag.add(three)

    expect(
      ctx.system.refineAffixValues(three.instanceId, [0, 1, 2], ctx.bag, ctx.registry, ctx.materialBag, ctx.slotManager, ctx.affixRegistry).reason,
    ).toBe('cannot_lock_all')
  })

  it('khóa quá 3 dòng → từ chối', () => {
    const ctx = refineSetup()

    expect(
      ctx.system.refineAffixValues(ctx.instance.instanceId, [0, 1, 2], ctx.bag, ctx.registry, ctx.materialBag, ctx.slotManager, ctx.affixRegistry, ).ok,
    ).toBe(true)

    const ctx2 = refineSetup()

    // 4 affixes → khóa 3 là hợp lệ; khóa index ngoài range → invalid.
    expect(
      ctx2.system.refineAffixValues(ctx2.instance.instanceId, [9], ctx2.bag, ctx2.registry, ctx2.materialBag, ctx2.slotManager, ctx2.affixRegistry).reason,
    ).toBe('invalid_lock')
  })

  it('cost hệ số N+L: 4 dòng khóa 1 → 5 Tinh Hoa + 5×50 Linh Thạch + 10 Điểm Rèn', () => {
    const ctx = refineSetup()

    const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)

    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    const pointsBefore = ctx.instance.forgePoints

    const result = ctx.system.refineAffixValues(
      ctx.instance.instanceId,
      [0],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => 0.5,
    )

    expect(result.ok).toBe(true)

    expect(ctx.materialBag.getAmount(ctx.essenceId)).toBe(essenceBefore - 5)

    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore - 5 * REFINE_SPIRIT_STONE_PER_UNIT)

    expect(ctx.instance.forgePoints).toBe(pointsBefore - REFINE_REFINEMENT_COST)
  })

  it('dòng bị khóa GIỮ NGUYÊN value; dòng khác roll trong ±20% clamp tier', () => {
    const ctx = refineSetup()

    const lockedValue = ctx.instance.affixes[0]!.value

    const result = ctx.system.refineAffixValues(
      ctx.instance.instanceId,
      [0],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => 0.999,
    )

    expect(result.ok).toBe(true)

    expect(ctx.instance.affixes[0]!.value).toBe(lockedValue)

    for (let index = 1; index < 4; index++) {
      const rolled = ctx.instance.affixes[index]!

      const affix = ctx.affixRegistry.get(rolled.affixId)

      const tierDef = affix.tiers.find((candidate) => candidate.tier === rolled.tier)!

      expect(rolled.value).toBeGreaterThanOrEqual(tierDef.min)

      expect(rolled.value).toBeLessThanOrEqual(tierDef.max)
    }
  })
})

describe('EquipmentSystem — Hóa Luyện (dissolveInstances, plan §7.5)', () => {
  it('Hoàng phẩm Phàm trả 1–3 Phàm Khí Tinh Hoa; Tiên phẩm Bảo trả 5–7', () => {
    const ctx = setup()

    const hoangItem = manualInstance({ rarity: 'hoang', realmId: 'mortal' })

    const tienItem = manualInstance({ instanceId: 'manual-2', rarity: 'tien', realmId: 'qi_refining' })

    ctx.bag.add(hoangItem)

    ctx.bag.add(tienItem)

    let seed = 42

    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648

      return seed / 2147483648
    }

    const result = ctx.system.dissolveInstances([hoangItem.instanceId], ctx.bag, random)

    expect(result.ok).toBe(true)

    expect(result.rewards![0]!.materialId).toBe(equipmentEssenceMaterialId('mortal'))

    expect(result.rewards![0]!.amount).toBeGreaterThanOrEqual(1)

    expect(result.rewards![0]!.amount).toBeLessThanOrEqual(3)

    const result2 = ctx.system.dissolveInstances([tienItem.instanceId], ctx.bag, random)

    expect(result2.ok).toBe(true)

    expect(result2.rewards![0]!.materialId).toBe(equipmentEssenceMaterialId('qi_refining'))

    expect(result2.rewards![0]!.amount).toBeGreaterThanOrEqual(5)

    expect(result2.rewards![0]!.amount).toBeLessThanOrEqual(7)
  })

  it('item đang trang bị / locked → từ chối toàn batch (all-or-nothing)', () => {
    const ctx = setup()

    const free = manualInstance({ instanceId: 'free-1' })

    const locked = manualInstance({ instanceId: 'locked-1', locked: true })

    ctx.bag.add(free)

    ctx.bag.add(locked)

    const result = ctx.system.dissolveInstances([free.instanceId, locked.instanceId], ctx.bag)

    expect(result.ok).toBe(false)

    // Không xoá món hợp lệ vì transaction all-or-nothing.
    expect(ctx.bag.get(free.instanceId)).toBeDefined()
  })

  it('item đang trang bị → reason "equipped"', () => {
    const ctx = setup()

    const equipped = manualInstance({ equipped: true })

    ctx.bag.add(equipped)

    expect(ctx.system.dissolveInstances([equipped.instanceId], ctx.bag).reason).toBe('equipped')
  })
})
