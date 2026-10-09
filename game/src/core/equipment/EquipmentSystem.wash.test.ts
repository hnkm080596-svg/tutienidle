import { describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises the scope-hidden
// system's ENABLED implementation (sec.11-15: dormant, not deleted),
// so the scope authority reports in-scope for this file.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

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
import { WASH_SPIRIT_STONE_COST_BY_QUALITY } from './RefinementBalance'

// Task 8 (phase7-gamemanager-split) - tach nguyen ven khoi
// EquipmentSystem.test.ts (describe 'EquipmentSystem - Tay Luyen
// (washAffixes, plan sec7.3)'), KHONG doi assertion nao, chi di chuyen +
// trung lap setup helper can thiet cho file test doc lap (cung convention
// EquipmentSystem.dissolve.test.ts, Task 9 dot truoc).

const TEMPLATE: Equipment = {
  id: 'test_sword',
  name: 'Test Sword',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'might', min: 10, max: 20 }],
  enhanceCost: [{ materialId: 'qi_refining_ore_century', amount: 1 }],
}

const ENHANCE_ORE = materials.find((m) => m.id === 'qi_refining_ore_century')!

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

  // Plan Workstream F - Linh Thach la MATERIAL: nap san so du lon.
  materialBag.add(SPIRIT_STONE_MATERIAL, 1_000_000)

  return { system, bag, registry, affixRegistry, slotManager, materialBag, player }
}

// Instance thu cong (khong qua createInstance random) - dung cho test
// can kiem soat chinh xac quality/affixes ban dau.
function manualInstance(overrides: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return makeInstance({
    instanceId: 'manual-1',
    itemId: TEMPLATE.id,
    grade: 'bat_pham',
    quality: 'hoang',
    mainStat: {
      id: 'roll-main-might',
      sourceId: 'roll-main',
      sourceType: 'equipment',
      stat: 'might',
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

    // Ngan sach ren per-item - full de test luong thanh cong.
    instance.forgeUsesRemaining = instance.forgeUsesTotal

    instance.equipped = true

    instance.affixes = overrides.affixes ?? [
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
    ['hoang', 2],
    ['huyen', 5],
    ['dia', 9],
    ['thien', 13],
    ['tien', 18],
  ] as const)(
    '%s: giữ nguyên số dòng hiện có (3), stat/tier/value hợp lệ, giữ mainStat và trừ đúng chi phí',
    (quality, tinhHoaCost) => {
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
      // Owner ruling 2026-10-09: so dong BAO TOAN - item 3 dong van 3
      // dong bat ke range max cua quality.
      expect(instance.affixes).toHaveLength(3)
      expect(instance.mainStat).toEqual(mainBefore)
      expect(instance.grade).toBe('bat_pham')
      expect(instance.quality).toBe(quality)
      expect(instance.forgeUsesRemaining).toBe(usesBefore - 1)
      expect(ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(
        tinhHoaBefore - tinhHoaCost,
      )
      expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore - WASH_SPIRIT_STONE_COST_BY_QUALITY[quality])

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

  // Owner ruling 2026-10-09 - so dong la cua ITEM, khong con roll theo
  // ITEM_QUALITY_SUBSTATS_RANGE: moi gia tri rng deu giu nguyen count,
  // ke ca roll 0 (truoc day ra 0 dong, trang do).
  it.each([
    ['hoang'],
    ['huyen'],
    ['dia'],
    ['thien'],
    ['tien'],
  ] as const)('%s: line count is preserved at every roll value, never 0', (quality) => {
    for (const rollSeed of [0, 0.25, 0.5, 0.75, 0.999_999]) {
      const ctx = washSetup()
      const instance = equippedWithAffixes(ctx, {
        instanceId: `wash-count-${quality}-${rollSeed}`,
        quality,
      })

      const result = wash(ctx, instance.instanceId, () => rollSeed)

      expect(result.ok, `${quality}:${rollSeed}`).toBe(true)
      expect(instance.affixes, `${quality}:${rollSeed}`).toHaveLength(3)
    }
  })

  it.each([
    ['hoang', 0, 1],
    ['hoang', 0.999_999, 1],
    ['huyen', 50 / 85 - 0.000_001, 1],
    ['huyen', 50 / 85, 2],
    ['huyen', 0.999_999, 2],
    ['dia', 0.35 - 0.000_001, 1],
    ['dia', 0.35, 2],
    ['dia', 0.7 - 0.000_001, 2],
    ['dia', 0.7, 3],
    ['dia', 0.999_999, 3],
    ['thien', 0.2 - 0.000_001, 1],
    ['thien', 0.2, 2],
    ['thien', 0.6 - 0.000_001, 2],
    ['thien', 0.6, 3],
    ['thien', 0.999_999, 3],
    ['tien', 0.1 - 0.000_001, 1],
    ['tien', 0.1, 2],
    ['tien', 0.45 - 0.000_001, 2],
    ['tien', 0.45, 3],
    ['tien', 0.999_999, 3],
  ] as const)(
    '%s: tier roll %s selects tier %s at cumulative boundaries',
    (quality, tierRoll, expectedTier) => {
      const ctx = washSetup()
      // 1-line item -> exactly 1 rerolled line (count preserved).
      const instance = equippedWithAffixes(ctx, {
        instanceId: `wash-tier-${quality}-${tierRoll}`,
        quality,
        affixes: [{ affixId: affixes[0]!.id, tier: 1, value: 5 }],
      })
      const rolls: number[] = []

      if (quality === 'tien') {
        rolls.push(0.15) // exalted chance: 0.15 is NOT < 0.15 -> miss
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
        // Decoy non-locked phai hop le o boots nhung khac stat compatible
        // (criticalRate o weapon) - dung wardRegenPerTurn (boots substat)
        // vi castSpeedPercent cu da retire (2026-09-04).
        stat: lockedPool ? 'criticalDamage' : 'wardRegenPerTurn',
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
        affixes: [{ affixId: affixes[0]!.id, tier: 1, value: 5 }],
      })
      const rolls: number[] = []

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

  // Owner ruling 2026-10-09: item 0 dong khong co gi de reroll - bi
  // chan o validation (reason no_affixes, khop Tinh Luyen), khong tru
  // luot Ren lan nguyen lieu.
  it('item 0 dòng phụ → no_affixes, không trừ gì', () => {
    const ctx = washSetup()
    const instance = equippedWithAffixes(ctx, { quality: 'huyen', affixes: [] })
    const usesBefore = instance.forgeUsesRemaining
    const essenceBefore = ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)
    const stonesBefore = ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    expect(wash(ctx, instance.instanceId, () => 0)).toEqual({ ok: false, reason: 'no_affixes' })
    expect(instance.affixes).toEqual([])
    expect(instance.forgeUsesRemaining).toBe(usesBefore)
    expect(ctx.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(essenceBefore)
    expect(ctx.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(stonesBefore)
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
    // R9 (AR-21): commit consumes the ticket; affixes stay domain-owned.
    expect(preview.ticketId).toBeDefined()
    expect(ctx.system.commitWashAffixes(
      instance.instanceId,
      preview.ticketId!,
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
    'Tiên Chất Exalted boundary %s: bonus chiếm slot dòng cuối, count bảo toàn =%s',
    (exaltedRoll, expectedBonus) => {
      const ctx = washSetup()
      const instance = equippedWithAffixes(ctx, {
        instanceId: `wash-exalted-boundary-${exaltedRoll}`,
        quality: 'tien',
      })
      const rolls = [exaltedRoll]

      expect(wash(ctx, instance.instanceId, () => rolls.shift() ?? 0).ok).toBe(true)
      // Count bao toan: exalted khong cong them dong ma chiem slot cuoi.
      expect(instance.affixes).toHaveLength(3)

      const exalted = instance.affixes.filter((rolled) => {
        const definition = ctx.affixRegistry.get(rolled.affixId)
        return definition.pool === 'supreme' && rolled.tier === 5
      })
      expect(exalted).toHaveLength(Number(expectedBonus))
      if (expectedBonus) {
        expect(instance.affixes[2]!.tier).toBe(5)
      }
    },
  )

  it.each([
    ['hoang'],
    ['huyen'],
    ['dia'],
    ['thien'],
  ] as const)('%s never receives an Exalted bonus', (quality) => {
    const ctx = washSetup()
    const instance = equippedWithAffixes(ctx, {
      instanceId: `wash-no-exalted-${quality}`,
      quality,
    })
    const rolls = [0.99, 0]

    expect(wash(ctx, instance.instanceId, () => rolls.shift() ?? 0).ok).toBe(true)
    expect(instance.affixes).toHaveLength(3)
    expect(instance.affixes.some((rolled) => rolled.tier === 5)).toBe(false)
  })

  it('no eligible affix rejects without changing equipment or either resource owner', () => {
    const ctx = washSetup()
    const incompatibleRegistry = new AffixRegistry()
    incompatibleRegistry.register({
      id: 'wash-incompatible-only',
      name: 'Wash incompatible only',
      // (2026-09-04) castSpeedPercent cu retire - dung wardRegenPerTurn
      // (boots substat) giu y "hop le boots, khong hop le weapon".
      stat: 'wardRegenPerTurn',
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
      `${ctx.instance.instanceId}:might`,
    ])

    expect(
      washWithRegistry(ctx, ctx.instance.instanceId, ctx.testRegistry, () => 0.99).ok,
    ).toBe(true)
    expect(ctx.instance.affixes).toEqual([{ affixId: ctx.newAffix.id, tier: 1, value: 1 }])
    expect(sourceModifierIds(ctx)).toEqual([
      `${ctx.instance.instanceId}:criticalRate`,
      `${ctx.instance.instanceId}:might`,
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
        preview.ticketId!,
        ctx.bag,
        ctx.slotManager,
        ctx.testRegistry,
      ).ok,
    ).toBe(true)
    expect(sourceModifierIds(ctx)).toEqual([
      `${ctx.instance.instanceId}:criticalRate`,
      `${ctx.instance.instanceId}:might`,
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
