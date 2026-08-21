import { describe, expect, it } from 'vitest'
import { EquipmentSystem, calculateEquipmentScale } from './EquipmentSystem'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { EquipmentSetRegistry } from './EquipmentSetRegistry'
import { AffixRegistry } from './AffixRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'
import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import type { EquipmentSet } from './EquipmentSet'
import { EQUIPMENT_RARITY_ORDER, EQUIPMENT_RARITY_AFFIX_SLOTS } from './EquipmentRarity'
import { EQUIPMENT_QUALITY_MAX_AFFIX_TIER, EQUIPMENT_QUALITY_UNLOCKED_POOLS, EQUIPMENT_QUALITY_MAX_FORGE_POINTS } from './EquipmentQuality'
import { affixes } from '../../data/equipment/affixes'
import { materials } from '../../data/materials/materials'
import { ZoneRegistry } from '../stage/ZoneRegistry'

const TEMPLATE: Equipment = {
  id: 'test_sword',
  name: 'Test Sword',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStat: { stat: 'attack', min: 10, max: 20 },
  enhanceCost: [{ materialId: 'black-iron', amount: 1 }],
  washCost: [{ materialId: 'black-iron', amount: 1 }],
  refineCost: [{ materialId: 'black-iron', amount: 1 }],
  forgeCost: [{ materialId: 'black-iron', amount: 1 }],
  upgradeQualityCost: [{ materialId: 'black-iron', amount: 1 }],
  addAffixCost: [{ materialId: 'black-iron', amount: 1 }],
  upgradeAffixCost: [{ materialId: 'black-iron', amount: 1 }],
}

const BLACK_IRON = materials.find(m => m.id === 'black-iron')!

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
    rarity: 'hoang_pham',
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

      if (instance.rarity === 'hoang_pham') {
        expect(instance.affixes).toHaveLength(0)
      }

      const maxAllowed = cap.prefix + cap.suffix + (instance.rarity === 'tien_pham' ? 1 : 0)

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

        const isAllowed = unlockedPools.includes(affix.pool) || (affix.pool === 'supreme' && instance.rarity === 'tien_pham')

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

    const before = materialBag.getAmount('black-iron')

    expect(system.forge(instance.instanceId, bag, registry, materialBag, slotManager, affixRegistry)).toBe(true)
    expect(instance.forgePoints).toBe(1)
    expect(materialBag.getAmount('black-iron')).toBeLessThan(before)
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

describe('EquipmentSystem.getActiveSetModifiers — mốc 2/4/6 món cùng Set', () => {
  const SET: EquipmentSet = {
    id: 'test_set',
    name: 'Test Thần',
    pathId: 'kiem_tu',
    colorVar: '--set-test',
    bonuses: [
      { pieces: 2, modifiers: [{ id: 'b2', sourceId: 'test_set:2', sourceType: 'equipment', stat: 'attack', flat: 1 }] },
      { pieces: 4, modifiers: [{ id: 'b4', sourceId: 'test_set:4', sourceType: 'equipment', stat: 'attack', flat: 2 }] },
      { pieces: 6, modifiers: [{ id: 'b6', sourceId: 'test_set:6', sourceType: 'equipment', stat: 'attack', flat: 3 }] },
    ],
  }

  function setupSet() {
    const { system, bag, registry, affixRegistry } = setup()
    const setRegistry = new EquipmentSetRegistry()
    setRegistry.register(SET)

    const slots: Equipment['slot'][] = ['weapon', 'helmet', 'armor', 'boots', 'ring', 'necklace']

    for (const slot of slots) {
      const template: Equipment = { ...TEMPLATE, id: `set_item_${slot}`, slot, setId: 'test_set' }
      registry.register(template)
    }

    return { system, bag, registry, affixRegistry, setRegistry, slots }
  }

  function equipCount(bag: EquipmentBag, registry: EquipmentRegistry, slots: Equipment['slot'][], count: number) {
    for (let i = 0; i < count; i++) {
      const slot = slots[i]!
      const instance = manualInstance({ instanceId: `set-${slot}`, itemId: `set_item_${slot}`, slot, equipped: true })
      bag.add(instance)
    }
  }

  it('dưới 2 món: không có bonus nào', () => {
    const { system, bag, registry, setRegistry, slots } = setupSet()
    equipCount(bag, registry, slots, 1)

    expect(system.getActiveSetModifiers(bag, registry, setRegistry)).toHaveLength(0)
  })

  it('2 món: chỉ bonus mốc 2', () => {
    const { system, bag, registry, setRegistry, slots } = setupSet()
    equipCount(bag, registry, slots, 2)

    const modifiers = system.getActiveSetModifiers(bag, registry, setRegistry)
    expect(modifiers.map(m => m.id)).toEqual(['b2'])
  })

  it('4 món: cộng dồn mốc 2 VÀ mốc 4', () => {
    const { system, bag, registry, setRegistry, slots } = setupSet()
    equipCount(bag, registry, slots, 4)

    const modifiers = system.getActiveSetModifiers(bag, registry, setRegistry)
    expect(modifiers.map(m => m.id).sort()).toEqual(['b2', 'b4'])
  })

  it('6 món: cộng dồn cả 3 mốc', () => {
    const { system, bag, registry, setRegistry, slots } = setupSet()
    equipCount(bag, registry, slots, 6)

    const modifiers = system.getActiveSetModifiers(bag, registry, setRegistry)
    expect(modifiers.map(m => m.id).sort()).toEqual(['b2', 'b4', 'b6'])
  })

  it('item KHÔNG có setId hoặc CHƯA equip thì không tính vào count', () => {
    const { system, bag, registry, setRegistry, slots } = setupSet()
    equipCount(bag, registry, slots, 2)

    // 1 item cùng set nhưng chưa equip — không được tính.
    bag.add(manualInstance({ instanceId: 'set-unequipped', itemId: `set_item_${slots[2]}`, slot: slots[2]!, equipped: false }))

    // 1 item không thuộc set nào, đã equip vào slot khác — cũng không ảnh hưởng.
    registry.register({ ...TEMPLATE, id: 'plain_item', slot: 'armor' })
    bag.add(manualInstance({ instanceId: 'plain-equipped', itemId: 'plain_item', slot: 'armor', equipped: true }))

    expect(system.getActiveSetModifiers(bag, registry, setRegistry).map(m => m.id)).toEqual(['b2'])
  })
})
