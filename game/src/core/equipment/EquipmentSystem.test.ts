import { describe, expect, it } from 'vitest'
import { afterEach, vi } from 'vitest'
import { EquipmentSystem, rollAffixRange, type RefineValueEntry } from './EquipmentSystem'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { AffixRegistry } from './AffixRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'
import type { Equipment } from './Equipment'
import type { Affix } from './Affix'
import type { AffixKind } from './Affix'
import type { EquipmentInstance } from './EquipmentInstance'
import type { EquipmentSlot } from './EquipmentTypes'
import { makeInstance } from './EquipmentInstance.fixture'
import type { ItemQuality } from '../item/ItemQuality'
import {
  ITEM_QUALITY_AFFIX_TIER,
  ITEM_QUALITY_FORGE_USES,
  ITEM_QUALITY_SUBSTATS_RANGE,
  ITEM_QUALITY_UNLOCKED_POOLS,
} from './ItemQualityBalance'
import { affixes } from '../../data/equipment/affixes'
import { materials } from '../../data/materials/materials'
import {
  SPIRIT_STONE_MATERIAL,
  SPIRIT_STONE_MATERIAL_ID,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID,
} from '../material/SpiritStoneMaterial'
import { isPercentStat } from '../stats/StatMetadata'
import { isValidEquipmentSubstat } from './EquipmentStatPolicy'
import { REFINE_SPIRIT_STONE_PER_UNIT } from './RefinementBalance'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'

const TEMPLATE: Equipment = {
  id: 'test_sword',
  name: 'Test Sword',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'attack', min: 10, max: 20 }],
  enhanceCost: [{ materialId: 'qi_refining_ore_huyen', amount: 1 }],
}

const ENHANCE_ORE = materials.find((m) => m.id === 'qi_refining_ore_huyen')!

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

  materialBag.add(ENHANCE_ORE, 100_000)

  // Plan Workstream F — Linh Thạch là MATERIAL: nạp sẵn số dư lớn.
  materialBag.add(SPIRIT_STONE_MATERIAL, 1_000_000)

  return { system, bag, registry, affixRegistry, slotManager, materialBag, player }
}

// Instance thủ công (không qua createInstance random) — dùng cho test
// cần kiểm soát chính xác quality/affixes ban đầu.
function manualInstance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return makeInstance({
    instanceId: 'manual-1',
    itemId: TEMPLATE.id,
    grade: 'bat_pham',
    quality: 'hoang',
    mainStat: {
      id: 'roll-main-attack',
      sourceId: 'roll-main',
      sourceType: 'equipment',
      stat: 'attack',
      flat: 15,
    },
    forgeUsesRemaining: 0,
    ...overrides,
  })
}

const PRODUCTION_SLOT_CASES = [
  ['weapon', 'attack', 'prefix', 3, 2, 0.99],
  ['helmet', 'maxHp', 'suffix', 1, 4, 0],
  ['armor', 'defense', 'prefix', 1, 4, 0],
  ['boots', 'evasionRate', 'suffix', 0, 5, 0],
  ['ring', 'criticalRate', 'prefix', 3, 2, 0.99],
  ['necklace', 'attackSpeed', 'prefix', 2, 3, 0],
] as const satisfies readonly [
  EquipmentSlot,
  Equipment['mainStats'][number]['stat'],
  AffixKind,
  number,
  number,
  number,
][]

const FIVE_TIER_TEST_LADDER: Affix['tiers'] = [
  { tier: 1, min: 0.01, max: 0.01 },
  { tier: 2, min: 0.02, max: 0.02 },
  { tier: 3, min: 0.03, max: 0.03 },
  { tier: 4, min: 0.04, max: 0.04 },
  { tier: 5, min: 0.05, max: 0.05 },
]

function productionSlotTemplate(
  slot: EquipmentSlot,
  mainStat: Equipment['mainStats'][number]['stat'],
): Equipment {
  return {
    ...TEMPLATE,
    id: `test_${slot}_affix_capacity`,
    slot,
    mainStats: [{ stat: mainStat, min: 10, max: 20 }],
  }
}

describe('EquipmentSystem.createInstance — roll pipeline invariants (Equipment Rework)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['mortal', 'cuu_pham'],
    ['tribulation', 'tien_pham'],
  ] as const)('grade của realm %s luôn cố định là %s cho mọi roll', (realmId, expectedGrade) => {
    const { system, affixRegistry, player } = setup()
    player.realmId = realmId

    for (let i = 0; i < 100; i++) {
      const instance = system.createInstance(TEMPLATE, player, affixRegistry)
      expect(instance.grade).toBe(expectedGrade)
    }
  })

  it.each([
    [0, 'hoang'],
    [0.749_999, 'hoang'],
    [0.75, 'hoang'],
    [0.750_001, 'huyen'],
    [0.899_999, 'huyen'],
    [0.9, 'huyen'],
    [0.900_001, 'dia'],
    [0.979_999, 'dia'],
    [0.98, 'dia'],
    [0.980_001, 'thien'],
    [0.999_899, 'thien'],
    [0.999_9, 'thien'],
    [0.999_901, 'tien'],
    [0.999_999, 'tien'],
  ] as const)('RNG %s rơi đúng bucket quality %s', (qualityRoll, expectedQuality) => {
    const { system, affixRegistry, player } = setup()
    const rolls = [qualityRoll, 0, 0, 0]
    vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.99)

    const instance = system.createInstance(TEMPLATE, player, affixRegistry)

    expect(instance.quality).toBe(expectedQuality)
  })

  it('2.000 roll ổn định bám phân phối của bốn quality phổ biến', () => {
    const { system, affixRegistry, player } = setup()
    const random = vi.spyOn(Math, 'random')
    const counts: Record<ItemQuality, number> = {
      hoang: 0,
      huyen: 0,
      dia: 0,
      thien: 0,
      tien: 0,
    }

    for (let index = 0; index < 2_000; index += 1) {
      const qualityRoll = (index + 0.5) / 2_000
      const rolls = [qualityRoll, 0, 0, 0]
      random.mockImplementation(() => rolls.shift() ?? 0.99)

      const instance = system.createInstance(TEMPLATE, player, affixRegistry)
      counts[instance.quality] += 1
    }

    expect(Math.abs(counts.hoang / 2_000 - 0.75)).toBeLessThan(0.03)
    expect(Math.abs(counts.huyen / 2_000 - 0.15)).toBeLessThan(0.03)
    expect(Math.abs(counts.dia / 2_000 - 0.08)).toBeLessThan(0.03)
    expect(Math.abs(counts.thien / 2_000 - 0.0199)).toBeLessThan(0.03)
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

  it.each([
    [
      'hoang',
      0.1,
      [
        [0.1, 0],
        [0.9, 1],
      ],
    ],
    [
      'tien',
      0.999_95,
      [
        [0.05, 0],
        [0.2, 1],
        [0.4, 2],
        [0.55, 3],
        [0.7, 4],
        [0.9, 5],
      ],
    ],
  ] as const)(
    '1.000 item %s chỉ có số substat trong miền cân bằng và chạm mọi giá trị',
    (expectedQuality, qualityRoll, countSamples) => {
      const { system, affixRegistry, player } = setup()
      const random = vi.spyOn(Math, 'random')
      const seen = new Set<number>()

      for (let index = 0; index < 1_000; index += 1) {
        const [affixCountRoll, expectedCount] = countSamples[index % countSamples.length]!
        const rolls = [qualityRoll, 0, 0, affixCountRoll]
        random.mockImplementation(() => rolls.shift() ?? 0.99)

        const instance = system.createInstance(TEMPLATE, player, affixRegistry)

        expect(instance.quality).toBe(expectedQuality)
        expect(instance.affixes).toHaveLength(expectedCount)
        seen.add(instance.affixes.length)
      }

      expect([...seen].sort()).toEqual(countSamples.map(([, count]) => count))
    },
  )

  it.each(PRODUCTION_SLOT_CASES)(
    'Hoàng %s (main %s) hiện thực count 1, fallback sang %s nếu prefix cạn',
    (slot, mainStat, expectedKind, _expectedPrefixes, _expectedSuffixes, _oldWrongKindRoll) => {
      const { system, affixRegistry, player } = setup()
      const rolls = [0.1, 0, 0, 0.99]
      vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.99)

      const instance = system.createInstance(
        productionSlotTemplate(slot, mainStat),
        player,
        affixRegistry,
      )

      expect(instance.affixes).toHaveLength(1)
      const rolledDefinition = affixRegistry.get(instance.affixes[0]!.affixId)
      expect(rolledDefinition.kind).toBe(expectedKind)
      expect(rolledDefinition.stat).not.toBe(mainStat)
      expect(isValidEquipmentSubstat(slot, rolledDefinition.stat)).toBe(true)
    },
  )

  it.each(PRODUCTION_SLOT_CASES)(
    'Tiên %s (main %s, Hoàng %s) hiện thực count 5 với split prefix/suffix %s/%s',
    (slot, mainStat, _hoangKind, expectedPrefixes, expectedSuffixes, _oldWrongKindRoll) => {
      const { system, affixRegistry, player } = setup()
      const rolls = [0.999_95, 0, 0, 0.9]
      vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.99)

      const instance = system.createInstance(
        productionSlotTemplate(slot, mainStat),
        player,
        affixRegistry,
      )
      const definitions = instance.affixes.map((rolled) => affixRegistry.get(rolled.affixId))
      const stats = definitions.map((definition) => definition.stat)

      expect(instance.affixes).toHaveLength(5)
      expect(definitions.filter((definition) => definition.kind === 'prefix')).toHaveLength(
        expectedPrefixes,
      )
      expect(definitions.filter((definition) => definition.kind === 'suffix')).toHaveLength(
        expectedSuffixes,
      )
      expect(new Set(stats).size).toBe(5)
      expect(stats).not.toContain(mainStat)

      for (const [index, definition] of definitions.entries()) {
        expect(isValidEquipmentSubstat(slot, definition.stat)).toBe(true)
        expect(ITEM_QUALITY_UNLOCKED_POOLS.tien).toContain(definition.pool)
        expect(instance.affixes[index]!.tier).toBeLessThanOrEqual(ITEM_QUALITY_AFFIX_TIER.tien)
      }
    },
  )

  it.each([
    ['hoang', 0.1, 0.99, 'basic', 1, 'advanced'],
    ['huyen', 0.8, 0.4, 'advanced', 2, 'specialized'],
    ['dia', 0.95, 0.25, 'specialized', 3, 'supreme'],
    ['thien', 0.99, 0.2, 'supreme', 4, null],
  ] as const)(
    '%s (quality RNG %s, count RNG %s) chỉ roll pool %s, chặn tier %s, khóa %s',
    (expectedQuality, qualityRoll, countRoll, expectedPool, expectedTier, lockedPool) => {
      const { system, player } = setup()
      const affixRegistry = new AffixRegistry()
      const allowed: Affix = {
        id: `test_${expectedQuality}_allowed_pool`,
        name: 'Allowed pool fixture',
        stat: 'criticalRate',
        kind: 'prefix',
        pool: expectedPool,
        slots: ['weapon'],
        tiers: FIVE_TIER_TEST_LADDER,
      }
      affixRegistry.register(allowed)

      if (lockedPool) {
        const locked: Affix = {
          id: `test_${expectedQuality}_locked_pool`,
          name: 'Locked pool fixture',
          stat: 'finalDamagePercent',
          kind: 'prefix',
          pool: lockedPool,
          slots: ['weapon'],
          tiers: FIVE_TIER_TEST_LADDER,
        }
        affixRegistry.register(locked)
      }

      const rolls = [qualityRoll, 0, 0, countRoll]
      vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.99)

      const instance = system.createInstance(TEMPLATE, player, affixRegistry)

      expect(instance.quality).toBe(expectedQuality)
      expect(instance.affixes).toHaveLength(1)
      expect(instance.affixes[0]).toMatchObject({ affixId: allowed.id, tier: expectedTier })
      expect(affixRegistry.get(instance.affixes[0]!.affixId).pool).toBe(expectedPool)
    },
  )

  it.each([
    ['candidate cùng kind', 'prefix', 'criticalRate'],
    ['fallback kind đối diện', 'suffix', 'criticalDamage'],
  ] as const)(
    'Hoàng bỏ affix chỉ có tier 5 trước random choice và dùng %s hợp lệ',
    (_scenario, validKind, validStat) => {
      const { system, player } = setup()
      const affixRegistry = new AffixRegistry()
      const valid: Affix = {
        id: `test_valid_${validKind}`,
        name: 'Valid low-tier fixture',
        stat: validStat,
        kind: validKind,
        pool: 'basic',
        slots: ['weapon'],
        tiers: [{ tier: 1, min: 0.01, max: 0.01 }],
      }
      const aboveCap: Affix = {
        id: 'test_above_hoang_cap',
        name: 'Above Hoàng cap fixture',
        stat: 'finalDamagePercent',
        kind: 'prefix',
        pool: 'basic',
        slots: ['weapon'],
        tiers: [{ tier: 5, min: 0.05, max: 0.05 }],
      }

      if (validKind === 'prefix') {
        affixRegistry.register(valid)
      }
      affixRegistry.register(aboveCap)
      if (validKind === 'suffix') {
        affixRegistry.register(valid)
      }

      const rolls = [0.1, 0, 0, 0.99]
      vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.99)

      const instance = system.createInstance(TEMPLATE, player, affixRegistry)

      expect(instance.affixes).toHaveLength(1)
      expect(instance.affixes[0]).toMatchObject({ affixId: valid.id, tier: 1 })
      expect(affixRegistry.get(instance.affixes[0]!.affixId).kind).toBe(validKind)
    },
  )

  it('Tiên quality thêm đúng một Exalted supreme tier 5 khi roll dưới 15%', () => {
    const { system, affixRegistry, player } = setup()
    const rolls = [0.999_95, 0, 0, 0, 0.149_999, 0]
    vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.99)

    const instance = system.createInstance(TEMPLATE, player, affixRegistry)

    expect(instance.quality).toBe('tien')
    expect(instance.affixes).toHaveLength(1)
    expect(affixRegistry.get(instance.affixes[0]!.affixId).pool).toBe('supreme')
    expect(instance.affixes[0]!.tier).toBe(5)
  })

  it.each(PRODUCTION_SLOT_CASES)(
    'Exalted thành công trên %s luôn chọn supreme tương thích dù RNG cũ chọn sai kind',
    (slot, mainStat, _hoangKind, _prefixes, _suffixes, oldWrongKindRoll) => {
      const { system, affixRegistry, player } = setup()
      const rolls = [0.999_95, 0, 0, 0, 0.1, oldWrongKindRoll]
      vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.99)

      const instance = system.createInstance(
        productionSlotTemplate(slot, mainStat),
        player,
        affixRegistry,
      )

      expect(instance.affixes).toHaveLength(1)
      const exalted = instance.affixes[0]!
      const definition = affixRegistry.get(exalted.affixId)
      expect(definition.pool).toBe('supreme')
      expect(definition.stat).not.toBe(mainStat)
      expect(isValidEquipmentSubstat(slot, definition.stat)).toBe(true)
      expect(exalted.tier).toBe(5)
    },
  )

  it('Exalted được giữ chỗ trước base roll để stat supreme duy nhất không bị tiêu thụ', () => {
    const { system, player } = setup()
    const affixRegistry = new AffixRegistry()
    const supreme: Affix = {
      id: 'test_supreme_first',
      name: 'Supreme first',
      stat: 'finalDamagePercent',
      kind: 'prefix',
      pool: 'supreme',
      slots: ['weapon'],
      tiers: [{ tier: 5, min: 0.12, max: 0.16 }],
    }
    const normal: Affix = {
      id: 'test_normal_second',
      name: 'Normal second',
      stat: 'criticalRate',
      kind: 'prefix',
      pool: 'basic',
      slots: ['weapon'],
      tiers: [{ tier: 1, min: 0.01, max: 0.02 }],
    }
    affixRegistry.register(supreme)
    affixRegistry.register(normal)
    const rolls = [0.999_95, 0, 0, 0.2, 0.1, 0, 0, 0.1, 0, 0]
    vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.99)

    const instance = system.createInstance(TEMPLATE, player, affixRegistry)
    const definitions = instance.affixes.map((rolled) => affixRegistry.get(rolled.affixId))

    expect(instance.affixes).toHaveLength(2)
    expect(definitions.map((definition) => definition.stat)).toEqual([
      'criticalRate',
      'finalDamagePercent',
    ])
    expect(new Set(definitions.map((definition) => definition.stat)).size).toBe(2)
    expect(instance.affixes.find((rolled) => rolled.affixId === supreme.id)?.tier).toBe(5)
  })

  it('Tiên quality không thêm Exalted khi roll đúng biên 15%', () => {
    const { system, affixRegistry, player } = setup()
    const rolls = [0.999_95, 0, 0, 0, 0.15]
    vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.99)

    const instance = system.createInstance(TEMPLATE, player, affixRegistry)

    expect(instance.quality).toBe('tien')
    expect(instance.affixes).toHaveLength(0)
  })

  it.each([
    [0.1, 'hoang', 5],
    [0.8, 'huyen', 10],
    [0.95, 'dia', 20],
    [0.99, 'thien', 40],
    [0.999_95, 'tien', 80],
  ] as const)(
    'quality %s khởi đầu với ngân sách Rèn %s/%s',
    (qualityRoll, expectedQuality, expectedUses) => {
      const { system, affixRegistry, player } = setup()
      const rolls = [qualityRoll, 0, 0, 0]
      vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.99)

      const instance = system.createInstance(TEMPLATE, player, affixRegistry)

      expect(instance.quality).toBe(expectedQuality)
      expect(instance.forgeUsesTotal).toBe(expectedUses)
      expect(instance.forgeUsesTotal).toBe(ITEM_QUALITY_FORGE_USES[instance.quality])
      expect(instance.forgeUsesRemaining).toBe(expectedUses)
    },
  )

  it.each([
    [0.1, 'hoang', 105],
    [0.8, 'huyen', 120.75],
    [0.95, 'dia', 136.5],
    [0.99, 'thien', 157.5],
    [0.999_95, 'tien', 183.75],
  ] as const)(
    'quality %s nhân implicit trước realm scale thành %s',
    (qualityRoll, expectedQuality, expectedFlat) => {
      const { system, affixRegistry, player } = setup()
      const rolls = [qualityRoll, 0, 0, 0]
      vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.99)
      const template: Equipment = {
        ...TEMPLATE,
        mainStats: [{ stat: 'attack', min: 100, max: 100 }],
      }

      const instance = system.createInstance(template, player, affixRegistry)

      expect(instance.quality).toBe(expectedQuality)
      expect(instance.mainStat.flat).toBeCloseTo(expectedFlat, 8)
    },
  )
})

describe('EquipmentSystem — Tẩy Luyện (washAffixes, plan §7.3)', () => {
  function washSetup(tinhHoa = 100) {
    const ctx = setup()

    const essence = materials.find((material) => material.id === LUYEN_KHI_TINH_HOA_ID)!

    if (tinhHoa > 0) {
      ctx.materialBag.add(essence, tinhHoa)
    }

    return ctx
  }

  function equippedWithAffixes(
    ctx: ReturnType<typeof setup>,
    overrides: Partial<EquipmentInstance> = {},
  ) {
    const instance = manualInstance(overrides)

    // Ngân sách rèn per-item — full để test luồng thành công.
    instance.forgeUsesRemaining = instance.forgeUsesTotal

    instance.equipped = true

    instance.affixes = [
      { affixId: affixes[0]!.id, tier: 1, value: 5 },
      { affixId: affixes[1]!.id, tier: 1, value: 5 },
      { affixId: affixes[2]!.id, tier: 1, value: 5 },
    ]

    ctx.bag.add(instance)

    return instance
  }

  function wash(
    ctx: ReturnType<typeof setup>,
    instanceId: string,
    random: () => number = () => 0.99,
  ) {
    return ctx.system.washAffixes(
      instanceId,
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      random,
    )
  }

  function washWithRegistry(
    ctx: ReturnType<typeof setup>,
    instanceId: string,
    affixRegistry: AffixRegistry,
    random: () => number,
  ) {
    return ctx.system.washAffixes(
      instanceId,
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      affixRegistry,
      random,
    )
  }

  const WASH_TEST_TIERS: Affix['tiers'] = [
    { tier: 1, min: 1, max: 1 },
    { tier: 2, min: 2, max: 2 },
    { tier: 3, min: 3, max: 3 },
  ]

  it('không nhận hoặc tiêu Quáng nữa', () => {
    const ctx = washSetup()
    const instance = equippedWithAffixes(ctx, { quality: 'huyen' })
    const oreBefore = ctx.materialBag.getAmount(ENHANCE_ORE.id)

    expect(wash(ctx, instance.instanceId).ok).toBe(true)
    expect(ctx.materialBag.getAmount(ENHANCE_ORE.id)).toBe(oreBefore)
  })

  it('forgeUsesRemaining = 0 → no_forge_uses và không mutate', () => {
    const ctx = washSetup()
    const instance = equippedWithAffixes(ctx)
    instance.forgeUsesRemaining = 0
    const affixesBefore = structuredClone(instance.affixes)
    const tinhHoaBefore = ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    expect(wash(ctx, instance.instanceId)).toEqual({ ok: false, reason: 'no_forge_uses' })
    expect(instance.affixes).toEqual(affixesBefore)
    expect(instance.forgeUsesRemaining).toBe(0)
    expect(ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(tinhHoaBefore)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
  })

  it('thiếu Luyện Khí Tinh Hoa → missing_tinh_hoa và giữ transaction nguyên vẹn', () => {
    const ctx = washSetup(0)
    const instance = equippedWithAffixes(ctx, { quality: 'tien' })
    const affixesBefore = structuredClone(instance.affixes)
    const usesBefore = instance.forgeUsesRemaining
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    expect(wash(ctx, instance.instanceId)).toEqual({ ok: false, reason: 'missing_tinh_hoa' })
    expect(instance.affixes).toEqual(affixesBefore)
    expect(instance.forgeUsesRemaining).toBe(usesBefore)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
  })

  it('thiếu Linh Thạch → missing_spirit_stone và không trừ Tinh Hoa/lượt Rèn', () => {
    const ctx = washSetup()
    ctx.materialBag.remove(SPIRIT_STONE_MATERIAL_ID, 1_000_000)
    const instance = equippedWithAffixes(ctx, { quality: 'dia' })
    const tinhHoaBefore = ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)
    const usesBefore = instance.forgeUsesRemaining

    expect(wash(ctx, instance.instanceId)).toEqual({ ok: false, reason: 'missing_spirit_stone' })
    expect(ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(tinhHoaBefore)
    expect(instance.forgeUsesRemaining).toBe(usesBefore)
  })

  it.each([
    ['hoang', 1, 2],
    ['huyen', 2, 5],
    ['dia', 3, 9],
    ['thien', 4, 13],
    ['tien', 5, 18],
  ] as const)(
    '%s: reroll đúng trần %i, stat/tier/value hợp lệ, giữ mainStat và trừ đúng chi phí',
    (quality, expectedMax, tinhHoaCost) => {
      const ctx = washSetup()
      const instance = equippedWithAffixes(ctx, {
        instanceId: `wash-quality-${quality}`,
        quality,
      })
      const mainBefore = structuredClone(instance.mainStat)
      const usesBefore = instance.forgeUsesRemaining
      const tinhHoaBefore = ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)
      const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

      expect(wash(ctx, instance.instanceId).ok).toBe(true)
      expect(instance.affixes).toHaveLength(expectedMax)
      expect(instance.affixes.length).toBeLessThanOrEqual(ITEM_QUALITY_SUBSTATS_RANGE[quality].max)
      expect(instance.mainStat).toEqual(mainBefore)
      expect(instance.grade).toBe('bat_pham')
      expect(instance.quality).toBe(quality)
      expect(instance.forgeUsesRemaining).toBe(usesBefore - 1)
      expect(ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(
        tinhHoaBefore - tinhHoaCost,
      )
      expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore - 100)

      const rolledStats = instance.affixes.map((rolled) => {
        const definition = ctx.affixRegistry.get(rolled.affixId)
        const tier = definition.tiers.find((candidate) => candidate.tier === rolled.tier)

        expect(tier).toBeDefined()
        expect(rolled.tier).toBeLessThanOrEqual(Math.min(ITEM_QUALITY_AFFIX_TIER[quality], 3))
        expect(rolled.value).toBeGreaterThanOrEqual(tier!.min)
        expect(rolled.value).toBeLessThanOrEqual(tier!.max)
        expect(definition.stat).not.toBe(instance.mainStat.stat)
        expect(isValidEquipmentSubstat(instance.slot, definition.stat)).toBe(true)

        return definition.stat
      })
      expect(new Set(rolledStats).size).toBe(rolledStats.length)
    },
  )

  it.each([
    ['hoang', 1],
    ['huyen', 2],
    ['dia', 3],
    ['thien', 4],
    ['tien', 5],
  ] as const)('%s: every line-count bin from 0 through %i is reachable', (quality, maxLines) => {
    for (let expectedCount = 0; expectedCount <= maxLines; expectedCount += 1) {
      const ctx = washSetup()
      const instance = equippedWithAffixes(ctx, {
        instanceId: `wash-count-${quality}-${expectedCount}`,
        quality,
      })
      const rolls = [(expectedCount + 0.25) / (maxLines + 1)]

      if (quality === 'tien') {
        rolls.push(0.15)
      }

      const result = wash(ctx, instance.instanceId, () => rolls.shift() ?? 0)

      expect(result.ok, `${quality}:${expectedCount}`).toBe(true)
      expect(instance.affixes, `${quality}:${expectedCount}`).toHaveLength(expectedCount)
    }

    const boundaryCtx = washSetup()
    const boundaryInstance = equippedWithAffixes(boundaryCtx, {
      instanceId: `wash-count-${quality}-max-boundary`,
      quality,
    })
    const boundaryRolls = [0.999_999]

    if (quality === 'tien') {
      boundaryRolls.push(0.15)
    }

    expect(
      wash(boundaryCtx, boundaryInstance.instanceId, () => boundaryRolls.shift() ?? 0).ok,
    ).toBe(true)
    expect(boundaryInstance.affixes).toHaveLength(maxLines)
  })

  it.each([
    ['hoang', 0.75, 0, 1],
    ['hoang', 0.75, 0.999_999, 1],
    ['huyen', 0.5, 50 / 85 - 0.000_001, 1],
    ['huyen', 0.5, 50 / 85, 2],
    ['huyen', 0.5, 0.999_999, 2],
    ['dia', 0.375, 0.35 - 0.000_001, 1],
    ['dia', 0.375, 0.35, 2],
    ['dia', 0.375, 0.7 - 0.000_001, 2],
    ['dia', 0.375, 0.7, 3],
    ['dia', 0.375, 0.999_999, 3],
    ['thien', 0.3, 0.2 - 0.000_001, 1],
    ['thien', 0.3, 0.2, 2],
    ['thien', 0.3, 0.6 - 0.000_001, 2],
    ['thien', 0.3, 0.6, 3],
    ['thien', 0.3, 0.999_999, 3],
    ['tien', 0.25, 0.1 - 0.000_001, 1],
    ['tien', 0.25, 0.1, 2],
    ['tien', 0.25, 0.45 - 0.000_001, 2],
    ['tien', 0.25, 0.45, 3],
    ['tien', 0.25, 0.999_999, 3],
  ] as const)(
    '%s: line-count roll %s and tier roll %s selects tier %s at cumulative boundaries',
    (quality, lineCountRoll, tierRoll, expectedTier) => {
      const ctx = washSetup()
      const instance = equippedWithAffixes(ctx, {
        instanceId: `wash-tier-${quality}-${tierRoll}`,
        quality,
      })
      const rolls: number[] = [lineCountRoll]

      if (quality === 'tien') {
        rolls.push(0.15)
      }

      rolls.push(0, tierRoll, 0)

      expect(wash(ctx, instance.instanceId, () => rolls.shift() ?? 0).ok).toBe(true)
      expect(instance.affixes).toHaveLength(1)
      expect(instance.affixes[0]!.tier).toBe(expectedTier)
    },
  )

  it.each([
    ['hoang', 'basic', 'advanced'],
    ['huyen', 'advanced', 'specialized'],
    ['dia', 'specialized', 'supreme'],
    ['thien', 'supreme', null],
    ['tien', 'supreme', null],
  ] as const)(
    '%s: rolls only an unlocked-pool affix that declares the item slot',
    (quality, expectedPool, lockedPool) => {
      const ctx = washSetup()
      const testRegistry = new AffixRegistry()
      const decoy: Affix = {
        id: `wash-decoy-${quality}`,
        name: 'Wash decoy',
        stat: lockedPool ? 'criticalDamage' : 'castSpeedPercent',
        kind: 'prefix',
        pool: lockedPool ?? expectedPool,
        slots: lockedPool ? ['weapon'] : ['boots'],
        tiers: WASH_TEST_TIERS,
      }
      const compatible: Affix = {
        id: `wash-compatible-${quality}`,
        name: 'Wash compatible',
        stat: 'criticalRate',
        kind: 'prefix',
        pool: expectedPool,
        slots: ['weapon'],
        tiers: WASH_TEST_TIERS,
      }
      testRegistry.register(decoy)
      testRegistry.register(compatible)
      const instance = equippedWithAffixes(ctx, {
        instanceId: `wash-pool-slot-${quality}`,
        quality,
      })
      const maxLines = quality === 'hoang' ? 1 : quality === 'huyen' ? 2 : quality === 'dia' ? 3 : quality === 'thien' ? 4 : 5
      const rolls = [1.25 / (maxLines + 1)]

      if (quality === 'tien') {
        rolls.push(0.15)
      }

      rolls.push(0, 0, 0)

      expect(
        washWithRegistry(ctx, instance.instanceId, testRegistry, () => rolls.shift() ?? 0).ok,
      ).toBe(true)
      expect(instance.affixes).toEqual([{ affixId: compatible.id, tier: 1, value: 1 }])
      expect(testRegistry.get(instance.affixes[0]!.affixId).pool).toBe(expectedPool)
      expect(testRegistry.get(instance.affixes[0]!.affixId).slots).toContain(instance.slot)
    },
  )

  it('count 0 là kết quả Tẩy Luyện hợp lệ', () => {
    const ctx = washSetup()
    const instance = equippedWithAffixes(ctx, { quality: 'huyen' })

    expect(wash(ctx, instance.instanceId, () => 0).ok).toBe(true)
    expect(instance.affixes).toEqual([])
    expect(instance.forgeUsesRemaining).toBe(instance.forgeUsesTotal - 1)
  })

  it('preview trừ đúng một lượt Rèn; commit không trừ lần hai', () => {
    const ctx = washSetup()
    const instance = equippedWithAffixes(ctx, { quality: 'huyen' })
    const before = instance.forgeUsesRemaining

    const preview = ctx.system.previewWashAffixes(
      instance.instanceId,
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0.99,
    )

    expect(preview.ok).toBe(true)
    expect(instance.forgeUsesRemaining).toBe(before - 1)
    expect(ctx.system.commitWashAffixes(
      instance.instanceId,
      preview.affixes ?? [],
      ctx.bag,
      ctx.slotManager,
      ctx.affixRegistry,
    ).ok).toBe(true)
    expect(instance.forgeUsesRemaining).toBe(before - 1)
  })

  it.each([
    [0.149_999, true],
    [0.15, false],
  ] as const)(
    'Tiên Chất Exalted boundary %s produces bonus=%s',
    (exaltedRoll, expectedBonus) => {
      const ctx = washSetup()
      const instance = equippedWithAffixes(ctx, {
        instanceId: `wash-exalted-boundary-${exaltedRoll}`,
        quality: 'tien',
      })
      const rolls = [0.99, exaltedRoll]

      expect(wash(ctx, instance.instanceId, () => rolls.shift() ?? 0).ok).toBe(true)
      expect(instance.affixes).toHaveLength(ITEM_QUALITY_SUBSTATS_RANGE.tien.max + Number(expectedBonus))

      const exalted = instance.affixes.filter((rolled) => {
        const definition = ctx.affixRegistry.get(rolled.affixId)
        return definition.pool === 'supreme' && rolled.tier === 5
      })
      expect(exalted).toHaveLength(Number(expectedBonus))
    },
  )

  it.each([
    ['hoang', 1],
    ['huyen', 2],
    ['dia', 3],
    ['thien', 4],
  ] as const)('%s never receives an Exalted bonus', (quality, maxLines) => {
    const ctx = washSetup()
    const instance = equippedWithAffixes(ctx, {
      instanceId: `wash-no-exalted-${quality}`,
      quality,
    })
    const rolls = [0.99, 0]

    expect(wash(ctx, instance.instanceId, () => rolls.shift() ?? 0).ok).toBe(true)
    expect(instance.affixes).toHaveLength(maxLines)
    expect(instance.affixes.some((rolled) => rolled.tier === 5)).toBe(false)
  })

  it('no eligible affix rejects without changing equipment or either resource owner', () => {
    const ctx = washSetup()
    const incompatibleRegistry = new AffixRegistry()
    incompatibleRegistry.register({
      id: 'wash-incompatible-only',
      name: 'Wash incompatible only',
      stat: 'castSpeedPercent',
      kind: 'prefix',
      pool: 'basic',
      slots: ['boots'],
      tiers: WASH_TEST_TIERS,
    })
    const instance = equippedWithAffixes(ctx, {
      instanceId: 'wash-no-eligible-affix',
      quality: 'hoang',
    })
    const affixesBefore = structuredClone(instance.affixes)
    const usesBefore = instance.forgeUsesRemaining
    const essenceBefore = ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    expect(
      washWithRegistry(ctx, instance.instanceId, incompatibleRegistry, () => 0.99),
    ).toEqual({ ok: false, reason: 'no_eligible_affix' })
    expect(instance.affixes).toEqual(affixesBefore)
    expect(instance.forgeUsesRemaining).toBe(usesBefore)
    expect(ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(essenceBefore)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
  })

  function modifierWashSetup(instanceId: string) {
    const ctx = washSetup()
    const testRegistry = new AffixRegistry()
    const oldAffix: Affix = {
      id: `${instanceId}-old-accuracy`,
      name: 'Old accuracy',
      stat: 'accuracyRating',
      kind: 'suffix',
      pool: 'basic',
      slots: ['weapon'],
      tiers: WASH_TEST_TIERS,
    }
    const newAffix: Affix = {
      id: `${instanceId}-new-critical-rate`,
      name: 'New critical rate',
      stat: 'criticalRate',
      kind: 'prefix',
      pool: 'basic',
      slots: ['weapon'],
      tiers: WASH_TEST_TIERS,
    }
    testRegistry.register(oldAffix)
    testRegistry.register(newAffix)
    const instance = manualInstance({
      instanceId,
      quality: 'hoang',
      equipped: false,
      forgeUsesTotal: 5,
      forgeUsesRemaining: 5,
      affixes: [{ affixId: oldAffix.id, tier: 1, value: 1 }],
    })
    ctx.bag.add(instance)
    expect(
      ctx.system.equip(
        instance.instanceId,
        ctx.bag,
        ctx.registry,
        ctx.slotManager,
        ctx.player,
        testRegistry,
      ),
    ).toBe(true)

    return { ...ctx, instance, testRegistry, oldAffix, newAffix }
  }

  function sourceModifierIds(ctx: ReturnType<typeof modifierWashSetup>): string[] {
    return ctx.system
      .getModifiers()
      .filter((modifier) => modifier.sourceId === ctx.instance.instanceId)
      .map((modifier) => modifier.id)
      .sort()
  }

  it('direct Wash removes old equipped modifiers and installs main/new modifiers exactly once', () => {
    const ctx = modifierWashSetup('wash-direct-modifiers')

    expect(sourceModifierIds(ctx)).toEqual([
      `${ctx.instance.instanceId}:accuracyRating`,
      `${ctx.instance.instanceId}:attack`,
    ])

    expect(
      washWithRegistry(ctx, ctx.instance.instanceId, ctx.testRegistry, () => 0.99).ok,
    ).toBe(true)
    expect(ctx.instance.affixes).toEqual([{ affixId: ctx.newAffix.id, tier: 1, value: 1 }])
    expect(sourceModifierIds(ctx)).toEqual([
      `${ctx.instance.instanceId}:attack`,
      `${ctx.instance.instanceId}:criticalRate`,
    ])
  })

  it('preview keeps equipped modifiers unchanged until commit refreshes them exactly once', () => {
    const ctx = modifierWashSetup('wash-commit-modifiers')
    const before = sourceModifierIds(ctx)
    const preview = ctx.system.previewWashAffixes(
      ctx.instance.instanceId,
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.testRegistry,
      () => 0.99,
    )

    expect(preview.ok).toBe(true)
    expect(sourceModifierIds(ctx)).toEqual(before)
    expect(
      ctx.system.commitWashAffixes(
        ctx.instance.instanceId,
        preview.affixes ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.testRegistry,
      ).ok,
    ).toBe(true)
    expect(sourceModifierIds(ctx)).toEqual([
      `${ctx.instance.instanceId}:attack`,
      `${ctx.instance.instanceId}:criticalRate`,
    ])
  })

  it('item locked/favorite → từ chối, KHÔNG trừ gì (nhất quán Hóa Luyện)', () => {
    for (const key of ['locked', 'favorite'] as const) {
      const ctx = washSetup()
      const instance = equippedWithAffixes(ctx, { [key]: true })
      const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
      const tinhHoaBefore = ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)
      const usesBefore = instance.forgeUsesRemaining
      const affixesBefore = structuredClone(instance.affixes)
      const result = wash(ctx, instance.instanceId)

      expect(result.ok, key).toBe(false)
      expect(result.reason, key).toBe(key)
      expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
      expect(ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(tinhHoaBefore)
      expect(instance.forgeUsesRemaining).toBe(usesBefore)
      expect(instance.affixes).toEqual(affixesBefore)
    }
  })
})

describe('EquipmentSystem — Tinh Luyện (refineAffixValues, plan §7.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function refineSetup() {
    const ctx = setup()

    const essenceId = LUYEN_KHI_TINH_HOA_ID

    const essence = materials.find((material) => material.id === essenceId)!

    ctx.materialBag.add(essence, 2_000)

    const instance = manualInstance()

    instance.affixes = [
      { affixId: affixes[0]!.id, tier: 2, value: 8 },
      { affixId: affixes[1]!.id, tier: 2, value: 25 },
      { affixId: affixes[2]!.id, tier: 2, value: 0.035 },
      { affixId: affixes[3]!.id, tier: 2, value: 0.032 },
    ]

    ctx.bag.add(instance)

    // Điểm Rèn per-item — cho vừa đủ để assert trừ đúng cost.
    instance.forgeUsesRemaining = instance.forgeUsesTotal

    return { ...ctx, instance, essenceId }
  }

  it('item locked/favorite → từ chối (nhất quán Hóa Luyện)', () => {
    for (const key of ['locked', 'favorite'] as const) {
      const ctx = refineSetup()

      ctx.instance[key] = true
      const affixesBefore = structuredClone(ctx.instance.affixes)
      const forgeUsesBefore = ctx.instance.forgeUsesRemaining
      const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)
      const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

      const result = ctx.system.refineAffixValues(
        ctx.instance.instanceId,
        [],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.slotManager,
        ctx.affixRegistry,
      )

      expect(result.ok, key).toBe(false)
      expect(result.reason, key).toBe(key)
      expect(ctx.instance.affixes, key).toEqual(affixesBefore)
      expect(ctx.instance.forgeUsesRemaining, key).toBe(forgeUsesBefore)
      expect(ctx.materialBag.getAmount(ctx.essenceId), key).toBe(essenceBefore)
      expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID), key).toBe(stonesBefore)
    }
  })

  it('forgeUsesRemaining = 0 → no_forge_uses và không mutate', () => {
    const ctx = refineSetup()
    ctx.instance.forgeUsesRemaining = 0
    const affixesBefore = structuredClone(ctx.instance.affixes)
    const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    const result = ctx.system.refineAffixValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => 0.5,
    )

    expect(result).toEqual({ ok: false, reason: 'no_forge_uses' })
    expect(ctx.instance.affixes).toEqual(affixesBefore)
    expect(ctx.instance.forgeUsesRemaining).toBe(0)
    expect(ctx.materialBag.getAmount(ctx.essenceId)).toBe(essenceBefore)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
  })

  it('khóa toàn bộ (3/3 dòng) → từ chối (cannot_lock_all)', () => {
    const ctx = refineSetup()

    const three = manualInstance({ instanceId: 'three-1' })

    three.affixes = ctx.instance.affixes.slice(0, 3)

    ctx.bag.add(three)

    expect(
      ctx.system.refineAffixValues(
        three.instanceId,
        [0, 1, 2],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.slotManager,
        ctx.affixRegistry,
      ).reason,
    ).toBe('cannot_lock_all')
  })

  it('khóa đúng 3 dòng hợp lệ; khóa quá 3 hoặc index sai đều từ chối atomic', () => {
    const ctx = refineSetup()

    expect(
      ctx.system.refineAffixValues(
        ctx.instance.instanceId,
        [0, 1, 2],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.slotManager,
        ctx.affixRegistry,
      ).ok,
    ).toBe(true)

    const ctx2 = refineSetup()

    // 4 affixes → khóa 3 là hợp lệ; khóa index ngoài range → invalid.
    expect(
      ctx2.system.refineAffixValues(
        ctx2.instance.instanceId,
        [9],
        ctx2.bag,
        ctx2.registry,
        ctx2.materialBag,
        ctx2.slotManager,
        ctx2.affixRegistry,
      ).reason,
    ).toBe('invalid_lock')

    const ctx3 = refineSetup()
    ctx3.instance.affixes.push({ affixId: affixes[4]!.id, tier: 2, value: 6 })
    const affixesBefore = structuredClone(ctx3.instance.affixes)
    const forgeUsesBefore = ctx3.instance.forgeUsesRemaining
    const essenceBefore = ctx3.materialBag.getAmount(ctx3.essenceId)
    const stonesBefore = ctx3.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    expect(
      ctx3.system.refineAffixValues(
        ctx3.instance.instanceId,
        [0, 1, 2, 3],
        ctx3.bag,
        ctx3.registry,
        ctx3.materialBag,
        ctx3.slotManager,
        ctx3.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'too_many_locks' })
    expect(ctx3.instance.affixes).toEqual(affixesBefore)
    expect(ctx3.instance.forgeUsesRemaining).toBe(forgeUsesBefore)
    expect(ctx3.materialBag.getAmount(ctx3.essenceId)).toBe(essenceBefore)
    expect(ctx3.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
  })

  it.each([
    ['hoang', 1],
    ['huyen', 3],
    ['dia', 5],
    ['thien', 7],
    ['tien', 9],
  ] as const)(
    '%s: preview thành công trừ đúng 1 lượt Rèn + %i Tinh Hoa + (N+L)×50 Linh Thạch phổ thông',
    (quality, tinhHoaCost) => {
      const ctx = refineSetup()
      ctx.instance.quality = quality
      ctx.instance.grade = 'luc_pham'
      ctx.instance.forgeUsesTotal = ITEM_QUALITY_FORGE_USES[quality]
      ctx.instance.forgeUsesRemaining = ctx.instance.forgeUsesTotal
      ctx.materialBag.add(SPIRIT_STONE_TRUNG_PHAM_MATERIAL, 1_000)
      const identityBefore = ctx.instance.affixes.map(({ affixId, tier }) => ({ affixId, tier }))
      const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)
      const genericStonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
      const middleStonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)
      const forgeUsesBefore = ctx.instance.forgeUsesRemaining

      const result = ctx.system.previewRefineValues(
        ctx.instance.instanceId,
        [0],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.affixRegistry,
        () => 0.5,
      )

      expect(result.ok).toBe(true)
      expect(ctx.instance.affixes.map(({ affixId, tier }) => ({ affixId, tier }))).toEqual(
        identityBefore,
      )
      expect(ctx.instance.grade).toBe('luc_pham')
      expect(ctx.instance.quality).toBe(quality)
      expect(ctx.instance.forgeUsesRemaining).toBe(forgeUsesBefore - 1)
      expect(ctx.materialBag.getAmount(ctx.essenceId)).toBe(essenceBefore - tinhHoaCost)
      expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(
        genericStonesBefore - 5 * REFINE_SPIRIT_STONE_PER_UNIT,
      )
      expect(ctx.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)).toBe(
        middleStonesBefore,
      )
    },
  )

  it('dòng bị khóa giữ nguyên; mọi dòng eligible không khóa tăng nghiêm ngặt và giữ identity/tier', () => {
    const ctx = refineSetup()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const before = structuredClone(ctx.instance.affixes)

    const result = ctx.system.refineAffixValues(
      ctx.instance.instanceId,
      [0],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => 0,
    )

    expect(result.ok).toBe(true)
    expect(ctx.instance.affixes[0]).toEqual(before[0])

    for (let index = 1; index < 4; index++) {
      const rolled = ctx.instance.affixes[index]!
      expect(rolled.affixId).toBe(before[index]!.affixId)
      expect(rolled.tier).toBe(before[index]!.tier)
      expect(rolled.value).toBeGreaterThan(before[index]!.value)
    }
  })

  it.each([
    [0, 8.4],
    [1, 9.6],
  ] as const)('RNG biên %s tăng đúng giá trị cũ theo biên 5–20%%', (roll, expected) => {
    const ctx = refineSetup()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]

    const result = ctx.system.refineAffixValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => roll,
    )

    expect(result.ok).toBe(true)
    expect(ctx.instance.affixes[0]!.value).toBeCloseTo(expected, 10)
  })

  it.each([
    ['âm', -1],
    ['lớn hơn một', 1.01],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ] as const)('RNG %s ngoài [0,1] bị từ chối atomic trước mọi spend', (_case, roll) => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const affixesBefore = structuredClone(ctx.instance.affixes)
    const forgeBefore = ctx.instance.forgeUsesRemaining
    const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    const result = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => roll,
    )

    expect(result).toEqual({ ok: false, reason: 'invalid_random_roll' })
    expect(ctx.instance.affixes).toEqual(affixesBefore)
    expect(ctx.instance.forgeUsesRemaining).toBe(forgeBefore)
    expect(ctx.materialBag.getAmount(ctx.essenceId)).toBe(essenceBefore)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
  })

  it('RNG sai ở dòng eligible sau vẫn rollback toàn transaction nhiều dòng', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [
      { affixId: affixes[0]!.id, tier: 2, value: 8 },
      { affixId: affixes[1]!.id, tier: 2, value: 25 },
    ]
    const affixesBefore = structuredClone(ctx.instance.affixes)
    const forgeBefore = ctx.instance.forgeUsesRemaining
    const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
    const rolls = [0, 1.01]
    const random = vi.fn(() => rolls.shift() ?? 0)

    expect(
      ctx.system.previewRefineValues(
        ctx.instance.instanceId,
        [],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.affixRegistry,
        random,
      ),
    ).toEqual({ ok: false, reason: 'invalid_random_roll' })
    expect(random).toHaveBeenCalledTimes(2)
    expect(ctx.instance.affixes).toEqual(affixesBefore)
    expect(ctx.instance.forgeUsesRemaining).toBe(forgeBefore)
    expect(ctx.materialBag.getAmount(ctx.essenceId)).toBe(essenceBefore)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
  })

  it('giữ phép tăng nghiêm ngặt cho tier thập phân rất nhỏ, không làm tròn về giá trị cũ', () => {
    const ctx = refineSetup()
    const tinyAffix: Affix = {
      id: 'refine-tiny-percent',
      name: 'Tiny percent',
      stat: 'criticalRate',
      kind: 'prefix',
      pool: 'basic',
      slots: ['weapon'],
      tiers: [{ tier: 1, min: 0.0001, max: 0.001 }],
    }
    ctx.affixRegistry.register(tinyAffix)
    ctx.instance.affixes = [{ affixId: tinyAffix.id, tier: 1, value: 0.0001 }]

    const result = ctx.system.refineAffixValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => 0,
    )

    expect(result.ok).toBe(true)
    expect(ctx.instance.affixes[0]!.value).toBeGreaterThan(0.0001)
    expect(ctx.instance.affixes[0]!.value).toBeCloseTo(0.000105, 12)
  })

  it('1.000 preview deterministic chỉ tăng và mỗi mức tăng chưa clamp nằm trong [5%, 20%]', () => {
    const ctx = refineSetup()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const oldValue = 8
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: oldValue }]

    for (let index = 0; index < 1_000; index += 1) {
      ctx.instance.forgeUsesRemaining = ctx.instance.forgeUsesTotal
      const sample = index / 999
      const result = ctx.system.previewRefineValues(
        ctx.instance.instanceId,
        [],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.affixRegistry,
        () => sample,
      )

      expect(result.ok, `sample ${index}`).toBe(true)
      const nextValue = result.values![0]!.value
      const increase = nextValue / oldValue - 1
      expect(nextValue, `sample ${index}`).toBeGreaterThan(oldValue)
      expect(increase, `sample ${index}`).toBeGreaterThanOrEqual(0.05 - 1e-12)
      expect(increase, `sample ${index}`).toBeLessThanOrEqual(0.2 + 1e-12)
    }
  })

  it('clamp sau phép nhân không vượt tier max dù phần trăm thực nhận nhỏ hơn 5%', () => {
    const ctx = refineSetup()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const oldValue = 11.9
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: oldValue }]

    const result = ctx.system.refineAffixValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => 1,
    )

    expect(result.ok).toBe(true)
    expect(ctx.instance.affixes[0]!.value).toBe(12)
    expect(ctx.instance.affixes[0]!.value).toBeGreaterThan(oldValue)
    expect(ctx.instance.affixes[0]!.value / oldValue - 1).toBeLessThan(0.05)
  })

  it('giá trị raw hữu hạn trên tier max bị loại thay vì normalize xuống rồi tính phí', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 800 }]
    const forgeBefore = ctx.instance.forgeUsesRemaining
    const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
    const random = vi.fn(() => 0)

    const result = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      random,
    )

    expect(result).toEqual({ ok: false, reason: 'no_eligible_affix' })
    expect(random).not.toHaveBeenCalled()
    expect(ctx.instance.forgeUsesRemaining).toBe(forgeBefore)
    expect(ctx.materialBag.getAmount(ctx.essenceId)).toBe(essenceBefore)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
  })

  it('giá trị raw hữu hạn dưới tier min nhân trước rồi mới clamp lên tier min', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 1 }]

    const result = ctx.system.refineAffixValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => 0,
    )

    expect(result).toEqual({ ok: true })
    expect(ctx.instance.affixes[0]!.value).toBe(7)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'giá trị raw không hữu hạn %s bị từ chối trước RNG và mọi spend',
    (invalidValue) => {
      const ctx = refineSetup()
      ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: invalidValue }]
      const before = structuredClone(ctx.instance.affixes)
      const forgeBefore = ctx.instance.forgeUsesRemaining
      const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)
      const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
      const random = vi.fn(() => 0)

      const result = ctx.system.previewRefineValues(
        ctx.instance.instanceId,
        [],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.affixRegistry,
        random,
      )

      expect(result).toEqual({ ok: false, reason: 'invalid_affix_value' })
      expect(random).not.toHaveBeenCalled()
      expect(ctx.instance.affixes).toEqual(before)
      expect(ctx.instance.forgeUsesRemaining).toBe(forgeBefore)
      expect(ctx.materialBag.getAmount(ctx.essenceId)).toBe(essenceBefore)
      expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
    },
  )

  it('loại dòng đã max và dòng bị khóa khỏi preview eligible', () => {
    const ctx = refineSetup()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    ctx.instance.affixes = [
      { affixId: affixes[0]!.id, tier: 2, value: 12 },
      { affixId: affixes[1]!.id, tier: 2, value: 25 },
      { affixId: affixes[2]!.id, tier: 2, value: 0.05 },
      { affixId: affixes[3]!.id, tier: 2, value: 0.032 },
    ]

    const result = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [3],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0.5,
    )

    expect(result.ok).toBe(true)
    expect(result.values?.map(({ index }) => index)).toEqual([1])
  })

  it('gọi RNG độc lập đúng một lần cho mỗi dòng eligible, không gọi cho locked/max/missing-tier', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [
      { affixId: affixes[0]!.id, tier: 2, value: 8 },
      { affixId: affixes[1]!.id, tier: 2, value: 25 },
      { affixId: affixes[2]!.id, tier: 2, value: 0.05 },
      { affixId: affixes[3]!.id, tier: 99, value: 0.032 },
      { affixId: affixes[4]!.id, tier: 2, value: 6 },
    ]
    const rolls = [0, 1]
    const random = vi.fn(() => {
      const roll = rolls.shift()

      if (roll === undefined) {
        throw new Error('Refine requested RNG for an ineligible line')
      }

      return roll
    })

    const result = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [1],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      random,
    )

    expect(result).toEqual({
      ok: true,
      values: [
        { index: 0, value: 8.4 },
        { index: 4, value: 7.199999999999999 },
      ],
    })
    expect(random).toHaveBeenCalledTimes(2)
    expect(rolls).toEqual([])
  })

  it('tất cả dòng không khóa đã tier max → no_eligible_affix và transaction nguyên vẹn', () => {
    const ctx = refineSetup()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    ctx.instance.affixes = [
      { affixId: affixes[0]!.id, tier: 2, value: 12 },
      { affixId: affixes[1]!.id, tier: 2, value: 40 },
      { affixId: affixes[2]!.id, tier: 2, value: 0.05 },
      { affixId: affixes[3]!.id, tier: 2, value: 0.04 },
    ]
    const affixesBefore = structuredClone(ctx.instance.affixes)
    const forgeUsesBefore = ctx.instance.forgeUsesRemaining
    const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    const result = ctx.system.refineAffixValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => 0.5,
    )

    expect(result).toEqual({ ok: false, reason: 'no_eligible_affix' })
    expect(ctx.instance.affixes).toEqual(affixesBefore)
    expect(ctx.instance.forgeUsesRemaining).toBe(forgeUsesBefore)
    expect(ctx.materialBag.getAmount(ctx.essenceId)).toBe(essenceBefore)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
  })

  it('thiếu Tinh Hoa hoặc Linh Thạch phổ thông đều từ chối trước mọi mutation', () => {
    for (const missing of ['essence', 'spirit_stone'] as const) {
      const ctx = refineSetup()
      ctx.instance.grade = 'luc_pham'
      ctx.materialBag.add(SPIRIT_STONE_TRUNG_PHAM_MATERIAL, 1_000)
      if (missing === 'essence') {
        ctx.materialBag.remove(ctx.essenceId, ctx.materialBag.getAmount(ctx.essenceId))
      } else {
        ctx.materialBag.remove(
          SPIRIT_STONE_MATERIAL_ID,
          ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID),
        )
      }
      const affixesBefore = structuredClone(ctx.instance.affixes)
      const forgeUsesBefore = ctx.instance.forgeUsesRemaining
      const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)
      const genericStonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
      const middleStonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)

      const result = ctx.system.refineAffixValues(
        ctx.instance.instanceId,
        [],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.slotManager,
        ctx.affixRegistry,
        () => 0.5,
      )

      expect(result).toEqual({
        ok: false,
        reason: missing === 'essence' ? 'missing_essence' : 'missing_spirit_stone',
      })
      expect(ctx.instance.affixes, missing).toEqual(affixesBefore)
      expect(ctx.instance.forgeUsesRemaining, missing).toBe(forgeUsesBefore)
      expect(ctx.materialBag.getAmount(ctx.essenceId), missing).toBe(essenceBefore)
      expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID), missing).toBe(
        genericStonesBefore,
      )
      expect(ctx.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID), missing).toBe(
        middleStonesBefore,
      )
    }
  })

  it('mọi dòng đều tier không khớp → từ chối no_eligible_affix, KHÔNG trừ cost (atomic)', () => {
    const ctx = refineSetup()

    // Ép tier=99 — chắc chắn không có trong affix.tiers.
    ctx.instance.affixes = [
      { affixId: affixes[0]!.id, tier: 99, value: 5 },
      { affixId: affixes[1]!.id, tier: 99, value: 5 },
    ]
    ctx.instance.forgeUsesRemaining = ctx.instance.forgeUsesTotal

    const stoneBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
    const renBefore = ctx.instance.forgeUsesRemaining
    const essenceBefore = ctx.materialBag.getAmount(ctx.essenceId)

    const result = ctx.system.refineAffixValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.slotManager,
      ctx.affixRegistry,
      () => 0.5,
    )

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_eligible_affix')
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stoneBefore)
    expect(ctx.materialBag.getAmount(ctx.essenceId)).toBe(essenceBefore)
    expect(ctx.instance.forgeUsesRemaining).toBe(renBefore)
  })

  it('commit không có preview nội bộ bị từ chối và không mutate', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const before = structuredClone(ctx.instance.affixes)

    const result = ctx.system.commitRefineValues(
      ctx.instance.instanceId,
      [{ index: 0, value: 8.4 }],
      ctx.bag,
      ctx.slotManager,
      ctx.affixRegistry,
    )

    expect(result).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes).toEqual(before)
  })

  it('commit từ chối object thay thế có cùng instanceId và cùng affix snapshot', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)

    const replacement: EquipmentInstance = {
      ...ctx.instance,
      mainStat: { ...ctx.instance.mainStat },
      affixes: ctx.instance.affixes.map((affix) => ({ ...affix })),
    }
    ctx.bag.remove(ctx.instance.instanceId)
    ctx.bag.add(replacement)

    expect(
      ctx.system.commitRefineValues(
        replacement.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(replacement.affixes[0]!.value).toBe(8)
  })

  it('commit từ chối cùng object bị remove rồi add lại trước khi commit', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)

    ctx.bag.remove(ctx.instance.instanceId)
    ctx.bag.add(ctx.instance)

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes[0]!.value).toBe(8)
  })

  it.each([
    ['itemId', (instance: EquipmentInstance) => { instance.itemId = 'changed-template' }],
    ['slot', (instance: EquipmentInstance) => { instance.slot = 'helmet' }],
    ['equipped', (instance: EquipmentInstance) => { instance.equipped = !instance.equipped }],
    ['locked', (instance: EquipmentInstance) => { instance.locked = !instance.locked }],
    ['favorite', (instance: EquipmentInstance) => { instance.favorite = !instance.favorite }],
    ['grade', (instance: EquipmentInstance) => { instance.grade = 'cuu_pham' }],
    ['quality', (instance: EquipmentInstance) => { instance.quality = 'huyen' }],
    ['forgeUsesTotal', (instance: EquipmentInstance) => { instance.forgeUsesTotal += 1 }],
    ['forgeUsesRemaining', (instance: EquipmentInstance) => { instance.forgeUsesRemaining += 1 }],
  ] as const)('commit từ chối preview stale khi %s đổi', (_case, mutate) => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)

    mutate(ctx.instance)
    const stateBeforeCommit = structuredClone(ctx.instance)

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance).toEqual(stateBeforeCommit)
  })

  it.each([
    [
      'realmLevel undefined -> defined',
      (_instance: EquipmentInstance) => {},
      (instance: EquipmentInstance) => { instance.realmLevel = 4 },
    ],
    [
      'realmLevel defined -> undefined',
      (instance: EquipmentInstance) => { instance.realmLevel = 4 },
      (instance: EquipmentInstance) => { delete instance.realmLevel },
    ],
    [
      'zoneId undefined -> defined',
      (_instance: EquipmentInstance) => {},
      (instance: EquipmentInstance) => { instance.zoneId = 'changed-zone' },
    ],
    [
      'zoneId defined -> undefined',
      (instance: EquipmentInstance) => { instance.zoneId = 'initial-zone' },
      (instance: EquipmentInstance) => { delete instance.zoneId },
    ],
    [
      'icon undefined -> defined',
      (_instance: EquipmentInstance) => {},
      (instance: EquipmentInstance) => { instance.icon = '/changed-icon.png' },
    ],
    [
      'icon defined -> undefined',
      (instance: EquipmentInstance) => { instance.icon = '/initial-icon.png' },
      (instance: EquipmentInstance) => { delete instance.icon },
    ],
  ] as const)(
    'commit từ chối preview stale khi optional %s',
    (_case, prepare, mutate) => {
      const ctx = refineSetup()
      ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
      prepare(ctx.instance)
      const preview = ctx.system.previewRefineValues(
        ctx.instance.instanceId,
        [],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.affixRegistry,
        () => 0,
      )
      expect(preview.ok).toBe(true)

      mutate(ctx.instance)
      const stateBeforeCommit = structuredClone(ctx.instance)

      expect(
        ctx.system.commitRefineValues(
          ctx.instance.instanceId,
          preview.values ?? [],
          ctx.bag,
          ctx.slotManager,
          ctx.affixRegistry,
        ),
      ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
      expect(ctx.instance).toEqual(stateBeforeCommit)
    },
  )

  it.each([
    ['id', (mainStat: EquipmentInstance['mainStat']) => { mainStat.id = 'changed-main-id' }],
    ['sourceId', (mainStat: EquipmentInstance['mainStat']) => { mainStat.sourceId = 'changed-source' }],
    ['sourceType', (mainStat: EquipmentInstance['mainStat']) => { mainStat.sourceType = 'buff' }],
    ['stat', (mainStat: EquipmentInstance['mainStat']) => { mainStat.stat = 'defense' }],
    ['tag', (mainStat: EquipmentInstance['mainStat']) => { mainStat.tag = 'changed-tag' }],
    ['flat', (mainStat: EquipmentInstance['mainStat']) => { mainStat.flat = 16 }],
    ['percent', (mainStat: EquipmentInstance['mainStat']) => { mainStat.percent = 0.1 }],
    ['multiplier', (mainStat: EquipmentInstance['mainStat']) => { mainStat.multiplier = 1.1 }],
    ['stacks', (mainStat: EquipmentInstance['mainStat']) => { mainStat.stacks = 2 }],
    ['maxStacks', (mainStat: EquipmentInstance['mainStat']) => { mainStat.maxStacks = 3 }],
    ['perLevelFlat', (mainStat: EquipmentInstance['mainStat']) => { mainStat.perLevelFlat = 0.5 }],
    ['perLevelPercent', (mainStat: EquipmentInstance['mainStat']) => { mainStat.perLevelPercent = 0.01 }],
  ] as const)('commit từ chối preview stale khi mainStat.%s đổi/thêm', (_field, mutate) => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)

    mutate(ctx.instance.mainStat)
    const stateBeforeCommit = structuredClone(ctx.instance)

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance).toEqual(stateBeforeCommit)
  })

  it('commit từ chối preview stale khi optional mainStat bị xóa', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    ctx.instance.mainStat.percent = 0.1
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)

    delete ctx.instance.mainStat.percent
    const stateBeforeCommit = structuredClone(ctx.instance)

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance).toEqual(stateBeforeCommit)
  })

  it('discardRefinePreview hủy capability đã trả phí', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)

    ctx.system.discardRefinePreview(ctx.instance.instanceId)

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes[0]!.value).toBe(8)
  })

  it('Hóa Luyện tay rồi add lại cùng object không hồi sinh Refine preview', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)
    expect(ctx.system.dissolveInstances([ctx.instance.instanceId], ctx.bag, () => 0).ok).toBe(true)

    ctx.bag.add(ctx.instance)

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes[0]!.value).toBe(8)
  })

  it('auto-dissolve rồi add lại cùng object không hồi sinh Refine preview', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)

    for (let index = 0; index < 500; index += 1) {
      ctx.bag.add(manualInstance({
        instanceId: `protected-${index}`,
        grade: 'nhat_pham',
        quality: 'tien',
        locked: true,
      }))
    }
    expect(ctx.bag.has(ctx.instance.instanceId)).toBe(false)

    ctx.bag.remove('protected-0')
    ctx.bag.add(ctx.instance)
    expect(ctx.bag.has(ctx.instance.instanceId)).toBe(true)

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes[0]!.value).toBe(8)
  })

  it('commit khi item đã biến mất tiêu provenance nên cùng instanceId không thể hồi sinh preview cũ', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)

    ctx.bag.remove(ctx.instance.instanceId)
    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'not_found' })

    ctx.bag.add(ctx.instance)
    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes[0]!.value).toBe(8)
  })

  it.each([
    ['payload finite khác preview', 8.5],
    ['payload giảm', 7.9],
    ['payload vượt trần tier', 13],
    ['payload NaN', Number.NaN],
    ['payload Infinity', Number.POSITIVE_INFINITY],
  ] as const)('commit từ chối %s và giữ nguyên item sau preview', (_case, tamperedValue) => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)
    const afterPreview = structuredClone(ctx.instance.affixes)
    const forgeAfterPreview = ctx.instance.forgeUsesRemaining
    const essenceAfterPreview = ctx.materialBag.getAmount(ctx.essenceId)
    const stonesAfterPreview = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    const result = ctx.system.commitRefineValues(
      ctx.instance.instanceId,
      [{ index: 0, value: tamperedValue }],
      ctx.bag,
      ctx.slotManager,
      ctx.affixRegistry,
    )

    expect(result).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes).toEqual(afterPreview)
    expect(ctx.instance.forgeUsesRemaining).toBe(forgeAfterPreview)
    expect(ctx.materialBag.getAmount(ctx.essenceId)).toBe(essenceAfterPreview)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesAfterPreview)
  })

  it.each([
    ['null entry', () => [null]],
    ['primitive entry', () => [7]],
    ['missing index', () => [{ value: 8.4 }]],
    ['missing value', () => [{ index: 0 }]],
    ['extra entry field', () => [{ index: 0, value: 8.4, extra: true }]],
  ] as const)('commit runtime-guard %s, consumes capability, và không throw/mutate', (_case, payload) => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)
    const stateAfterPreview = structuredClone(ctx.instance)
    let result: ReturnType<typeof ctx.system.commitRefineValues> | undefined

    expect(() => {
      result = ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        payload() as unknown as readonly RefineValueEntry[],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      )
    }).not.toThrow()
    expect(result).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance).toEqual(stateAfterPreview)
    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
      ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    })

  it.each([
    ['null payload', null],
    ['object payload', { length: 1 }],
    ['string payload', 'x'],
    ['number payload', 7],
  ] as const)(
    'commit runtime-guard top-level %s, consumes capability, và không throw/mutate',
    (_case, payload) => {
      const ctx = refineSetup()
      ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
      const preview = ctx.system.previewRefineValues(
        ctx.instance.instanceId,
        [],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.affixRegistry,
        () => 0,
      )
      expect(preview.ok).toBe(true)
      const stateAfterPreview = structuredClone(ctx.instance)
      let result: ReturnType<typeof ctx.system.commitRefineValues> | undefined

      expect(() => {
        result = ctx.system.commitRefineValues(
          ctx.instance.instanceId,
          payload as unknown as readonly RefineValueEntry[],
          ctx.bag,
          ctx.slotManager,
          ctx.affixRegistry,
        )
      }).not.toThrow()
      expect(result).toEqual({ ok: false, reason: 'invalid_refine_preview' })
      expect(ctx.instance).toEqual(stateAfterPreview)
      expect(
        ctx.system.commitRefineValues(
          ctx.instance.instanceId,
          preview.values ?? [],
          ctx.bag,
          ctx.slotManager,
          ctx.affixRegistry,
        ),
      ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    },
  )

  it.each([
    ['missing payload entry', (values: readonly RefineValueEntry[]) => values.slice(0, 1)],
    ['extra payload entry', (values: readonly RefineValueEntry[]) => [...values, values[0]!]],
    ['duplicate payload entry', (values: readonly RefineValueEntry[]) => [values[0]!, values[0]!]],
  ] as const)('commit từ chối %s và consumes capability', (_case, tamper) => {
    const ctx = refineSetup()
    ctx.instance.affixes = [
      { affixId: affixes[0]!.id, tier: 2, value: 8 },
      { affixId: affixes[1]!.id, tier: 2, value: 25 },
    ]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        tamper(preview.values ?? []),
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        preview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes.map(({ value }) => value)).toEqual([8, 25])
  })

  it.each([
    [
      'affix identity',
      (ctx: ReturnType<typeof refineSetup>) => {
        ctx.instance.affixes[0]!.affixId = affixes[4]!.id
      },
    ],
    [
      'tier',
      (ctx: ReturnType<typeof refineSetup>) => {
        ctx.instance.affixes[0]!.tier = 1
      },
    ],
    [
      'raw current value',
      (ctx: ReturnType<typeof refineSetup>) => {
        ctx.instance.affixes[0]!.value = 8.1
      },
    ],
    [
      'affix order',
      (ctx: ReturnType<typeof refineSetup>) => {
        ctx.instance.affixes.reverse()
      },
    ],
  ] as const)('commit từ chối preview stale khi %s đổi', (_case, mutate) => {
    const ctx = refineSetup()
    ctx.instance.affixes = [
      { affixId: affixes[0]!.id, tier: 2, value: 8 },
      { affixId: affixes[1]!.id, tier: 2, value: 25 },
    ]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)

    mutate(ctx)
    const staleState = structuredClone(ctx.instance.affixes)
    const result = ctx.system.commitRefineValues(
      ctx.instance.instanceId,
      preview.values ?? [],
      ctx.bag,
      ctx.slotManager,
      ctx.affixRegistry,
    )

    expect(result).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes).toEqual(staleState)
  })

  it('commit yêu cầu payload đúng cả thứ tự và chỉ dùng được một lần', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [
      { affixId: affixes[0]!.id, tier: 2, value: 8 },
      { affixId: affixes[1]!.id, tier: 2, value: 25 },
    ]
    const preview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(preview.ok).toBe(true)
    const values = preview.values ?? []

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        [...values].reverse(),
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes.map(({ value }) => value)).toEqual([8, 25])

    const secondPreview = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(secondPreview.ok).toBe(true)
    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        secondPreview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: true })
    const committed = structuredClone(ctx.instance.affixes)

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        secondPreview.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes).toEqual(committed)
  })

  it('preview thất bại xóa provenance cũ nên payload đã trả phí không thể sống lại', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const first = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(first.ok).toBe(true)

    ctx.materialBag.remove(ctx.essenceId, ctx.materialBag.getAmount(ctx.essenceId))
    expect(
      ctx.system.previewRefineValues(
        ctx.instance.instanceId,
        [],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.affixRegistry,
        () => 1,
      ),
    ).toEqual({ ok: false, reason: 'missing_essence' })
    const beforeCommit = structuredClone(ctx.instance.affixes)

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        first.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes).toEqual(beforeCommit)
  })

  it('preview thất bại của item khác cũng xóa capability trả phí trước đó', () => {
    const ctx = refineSetup()
    ctx.instance.affixes = [{ affixId: affixes[0]!.id, tier: 2, value: 8 }]
    const first = ctx.system.previewRefineValues(
      ctx.instance.instanceId,
      [],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )
    expect(first.ok).toBe(true)

    expect(
      ctx.system.previewRefineValues(
        'missing-item',
        [],
        ctx.bag,
        ctx.registry,
        ctx.materialBag,
        ctx.affixRegistry,
        () => 0,
      ),
    ).toEqual({ ok: false, reason: 'not_found' })

    expect(
      ctx.system.commitRefineValues(
        ctx.instance.instanceId,
        first.values ?? [],
        ctx.bag,
        ctx.slotManager,
        ctx.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(ctx.instance.affixes[0]!.value).toBe(8)
  })
})

describe('EquipmentSystem — Hóa Luyện (dissolveInstances, plan §7.5)', () => {
  it('Hoàng phẩm Phàm trả 1–3 Phàm Khí Tinh Hoa; Tiên phẩm Bảo trả 5–7', () => {
    const ctx = setup()

    const hoangItem = manualInstance({ quality: 'hoang', grade: 'cuu_pham' })

    const tienItem = manualInstance({
      instanceId: 'manual-2',
      quality: 'tien',
      grade: 'bat_pham',
    })

    ctx.bag.add(hoangItem)

    ctx.bag.add(tienItem)

    let seed = 42

    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648

      return seed / 2147483648
    }

    const result = ctx.system.dissolveInstances([hoangItem.instanceId], ctx.bag, random)

    expect(result.ok).toBe(true)

    expect(result.rewards![0]!.materialId).toBe(LUYEN_KHI_TINH_HOA_ID)

    expect(result.rewards![0]!.amount).toBeGreaterThanOrEqual(1)

    expect(result.rewards![0]!.amount).toBeLessThanOrEqual(3)

    const result2 = ctx.system.dissolveInstances([tienItem.instanceId], ctx.bag, random)

    expect(result2.ok).toBe(true)

    expect(result2.rewards![0]!.materialId).toBe(LUYEN_KHI_TINH_HOA_ID)

    expect(result2.rewards![0]!.amount).toBeGreaterThanOrEqual(5)

    expect(result2.rewards![0]!.amount).toBeLessThanOrEqual(7)
  })

  it('item Phẩm cao vẫn trả Luyện Khí Tinh Hoa duy nhất', () => {
    const ctx = setup()

    const item = manualInstance({
      instanceId: 'golden-1',
      quality: 'huyen',
      grade: 'luc_pham',
    })

    ctx.bag.add(item)

    const result = ctx.system.dissolveInstances([item.instanceId], ctx.bag, () => 0.5)

    expect(result.ok).toBe(true)

    expect(result.rewards![0]!.materialId).toBe(LUYEN_KHI_TINH_HOA_ID)
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

  it('selection TRÙNG id chỉ tính reward 1 lần (chặn nhân bản Tinh Hoa)', () => {
    const ctx = setup()

    const item = manualInstance({ instanceId: 'dup-1', quality: 'hoang', grade: 'cuu_pham' })

    ctx.bag.add(item)

    const result = ctx.system.dissolveInstances(['dup-1', 'dup-1', 'dup-1'], ctx.bag)

    expect(result.ok).toBe(true)

    // Chỉ 1 reward duy nhất dù id lặp 3 lần.
    expect(result.rewards).toHaveLength(1)

    // Item bị xoá đúng 1 lần.
    expect(ctx.bag.get('dup-1')).toBeUndefined()
  })
})

describe('EquipmentBag — dedupe instanceId (review 2026-08-28)', () => {
  it('add trùng instanceId KHÔNG tạo bản sao thứ hai', () => {
    const bag = new EquipmentBag()

    const instance = manualInstance({ instanceId: 'dedupe-1' })

    bag.add(instance)
    bag.add({ ...instance })

    expect(bag.getAll()).toHaveLength(1)
    expect(bag.getEquipped().length).toBeLessThanOrEqual(1)
  })
})

describe('EquipmentSystem — chi phí Tinh Luyện theo Chất', () => {
  it.each([
    ['hoang', 1],
    ['huyen', 3],
    ['dia', 5],
    ['thien', 7],
    ['tien', 9],
  ] as const)('%s: getRefineCost trả đúng Tinh Hoa, 1 lượt Rèn và Linh Thạch phổ thông', (quality, tinhHoa) => {
    const { system } = setup()

    expect(system.getRefineCost(4, 1, quality)).toEqual({
      essenceUnits: tinhHoa,
      spiritStone: 5 * REFINE_SPIRIT_STONE_PER_UNIT,
      spiritStoneMaterialId: SPIRIT_STONE_MATERIAL_ID,
      refinementPoints: 1,
    })
  })

  it('discount khác 0: getRefineCost hiển thị đúng chính xác debit thực tế, forge vẫn trừ một', () => {
    const ctx = setup()
    const essence = materials.find((material) => material.id === LUYEN_KHI_TINH_HOA_ID)!
    ctx.materialBag.add(essence, 100)
    ctx.system.setCostDiscountPercent(0.2)
    const instance = manualInstance({
      quality: 'tien',
      forgeUsesRemaining: 80,
      forgeUsesTotal: 80,
      affixes: [
        { affixId: affixes[0]!.id, tier: 2, value: 8 },
        { affixId: affixes[1]!.id, tier: 2, value: 25 },
      ],
    })
    ctx.bag.add(instance)
    const displayedCost = ctx.system.getRefineCost(2, 1, 'tien')
    const essenceBefore = ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    const result = ctx.system.previewRefineValues(
      instance.instanceId,
      [1],
      ctx.bag,
      ctx.registry,
      ctx.materialBag,
      ctx.affixRegistry,
      () => 0,
    )

    expect(result.ok).toBe(true)
    expect(displayedCost).toEqual({
      essenceUnits: 7,
      spiritStone: 120,
      spiritStoneMaterialId: SPIRIT_STONE_MATERIAL_ID,
      refinementPoints: 1,
    })
    expect(essenceBefore - ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(
      displayedCost.essenceUnits,
    )
    expect(stonesBefore - ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(
      displayedCost.spiritStone,
    )
    expect(instance.forgeUsesRemaining).toBe(79)
  })
})
