import { describe, expect, it } from 'vitest'
import { EquipmentSystem } from './EquipmentSystem'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { AffixRegistry } from './AffixRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { createDefaultPlayer } from '../player/Player'
import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import { makeInstance } from './EquipmentInstance.fixture'
import { affixes } from '../../data/equipment/affixes'
import { materials } from '../../data/materials/materials'
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'

// Task 9 (perf-optimize-pass Phase 5, EquipmentSystem sibling-file split) -
// tach nguyen ven khoi EquipmentSystem.test.ts (describe 'EquipmentSystem -
// Hoa Luyen (dissolveInstances, plan sec7.5)'), KHONG doi assertion nao, chi
// di chuyen + trung lap setup helper can thiet cho file test doc lap.

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

    // Khong xoa mon hop le vi transaction all-or-nothing.
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

    // Chi 1 reward duy nhat du id lap 3 lan.
    expect(result.rewards).toHaveLength(1)

    // Item bi xoa dung 1 lan.
    expect(ctx.bag.get('dup-1')).toBeUndefined()
  })
})
