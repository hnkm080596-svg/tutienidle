import { describe, expect, it } from 'vitest'
import { EquipmentSystem } from './EquipmentSystem'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { AffixRegistry } from './AffixRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'
import type { Equipment } from './Equipment'
import type { Affix } from './Affix'
import type { EquipmentInstance } from './EquipmentInstance'
import { makeInstance } from './EquipmentInstance.fixture'
import { ITEM_QUALITY_AFFIX_TIER, ITEM_QUALITY_SUBSTATS_RANGE } from './ItemQualityBalance'
import { affixes } from '../../data/equipment/affixes'
import { materials } from '../../data/materials/materials'
import { SPIRIT_STONE_MATERIAL, SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import { isValidEquipmentSubstat } from './EquipmentStatPolicy'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'

// Task 8 (phase7-gamemanager-split) — tách nguyên vẹn khỏi
// EquipmentSystem.test.ts (describe 'EquipmentSystem — Tẩy Luyện
// (washAffixes, plan §7.3)'), KHÔNG đổi assertion nào, chỉ di chuyển +
// trùng lặp setup helper cần thiết cho file test độc lập (cùng convention
// EquipmentSystem.dissolve.test.ts, Task 9 đợt trước).

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
      grade: 'cuu_pham',
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
    ).toEqual({ ok: true })

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
