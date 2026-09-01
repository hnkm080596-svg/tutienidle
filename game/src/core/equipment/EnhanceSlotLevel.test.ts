// @vitest-environment node
// Task 10 (rework P3) — slot-level enhance: đường cong mũ + pity 10 +
// max 100 + scale 0.06. Mock random kiểm soát để không flaky.
import { describe, expect, it, vi, afterEach } from 'vitest'
import { EquipmentSystem } from './EquipmentSystem'
import { EquipmentBag } from './EquipmentBag'
import { EquipmentRegistry } from './EquipmentRegistry'
import { EquipmentSlotManager } from './EquipmentSlotManager'
import { createDefaultSlotState, type EquipmentSlotState } from './EquipmentSlotState'
import { AffixRegistry } from './AffixRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { materials } from '../../data/materials/materials'
import type { Equipment } from './Equipment'
import type { PlayerData } from '../player/Player'
import { createDefaultPlayer } from '../player/Player'
import type { EventBus } from '../events/EventBus'
import type { EquipmentInstance } from './EquipmentInstance'

function registerMaterials(materialBag: MaterialBag): void {
  for (const material of materials) {
    materialBag.add(material, 1000)
  }
}

function makePlayer(): PlayerData {
  return createDefaultPlayer()
}

function makeEquipment(slot: EquipmentSlotState['slot'] = 'weapon'): Equipment {
  return {
    id: `base_${slot}`,
    name: 'Kiếm',
    slot,
    maxEnhanceLevel: 10,
    implicitStats: [],
    mainStats: [{ stat: 'attack', min: 10, max: 20 }],
    affixPools: [],
    iconPool: [],
  } as unknown as Equipment
}function makeInstance(id: string): EquipmentInstance {
  return {
    instanceId: id,
    itemId: 'base_weapon',
    slot: 'weapon',
    equipped: false,
    quality: 'hoang',
    grade: 'cuu_pham',
    realmLevel: 1,
    forgeUsesTotal: 5,
    forgeUsesRemaining: 5,
    mainStat: { id: `${id}:main`, sourceId: id, sourceType: 'equipment', stat: 'attack', flat: 12 },
    affixes: [],
  } as unknown as EquipmentInstance
}

function setup(options: { random?: () => number } = {}) {
  // Constructor nhận costCatalog (không phải eventBus) — undefined là
  // hợp lệ (fallback template/fallback cost, pattern EquipmentSystem.test).
  const system = new EquipmentSystem()
  const bag = new EquipmentBag()
  const registry = new EquipmentRegistry()
  const slotManager = new EquipmentSlotManager()
  const affixRegistry = new AffixRegistry()
  const materialBag = new MaterialBag()

  registry.register(makeEquipment())

  for (const instance of [makeInstance('inst-1'), makeInstance('inst-2')]) {
    bag.add(instance)
  }

  registerMaterials(materialBag)

  if (options.random) {
    vi.spyOn(Math, 'random').mockImplementation(options.random)
  }

  return { system, bag, registry, slotManager, affixRegistry, materialBag, player: makePlayer() }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EquipmentSystem.enhance — slot-level + pity (Task 10)', () => {
  it('L1 rate 100%: luôn thành công, level 0 → 1, streak giữ 0', () => {
    const { system, bag, registry, materialBag, slotManager, affixRegistry, player } = setup({
      random: () => 0.99, // < 100 → thành công; chứng minh rate L1 = 100
    })

    const result = system.enhance('weapon', player.realmId, bag, registry, materialBag, slotManager, affixRegistry)

    expect(result.ok).toBe(true)
    expect(slotManager.get('weapon').enhanceLevel).toBe(1)
    expect(slotManager.get('weapon').enhanceFailStreak).toBe(0)
  })

  it('rate thấp: fail → streak +1, KHÔNG đổi level, đã trừ nguyên liệu (không phạt khác)', () => {
    // L1 rate 100 (0.5<100 ok); L2 rate 96 (0.5<96 ok) → lên L2.
    // L3 rate 92 → random 0.99×100=99 ≥ 92 → FAIL.
    const randoms = [0.5, 0.5, 0.99]
    let index = -1

    const { system, bag, registry, materialBag, slotManager, affixRegistry, player } = setup({
      random: () => {
        index += 1

        return randoms[Math.min(index, randoms.length - 1)]!
      },
    })

    // Lên L2 trước (2 lần success tại rate 100).
    system.enhance('weapon', player.realmId, bag, registry, materialBag, slotManager, affixRegistry)
    system.enhance('weapon', player.realmId, bag, registry, materialBag, slotManager, affixRegistry)

    expect(slotManager.get('weapon').enhanceLevel).toBe(2)

    const stonesBefore = materialBag.getAmount(
      requireSpiritStoneIdForLevel(materialBag),
    )

    const fail = system.enhance('weapon', player.realmId, bag, registry, materialBag, slotManager, affixRegistry)

    expect(fail.ok).toBe(false)
    expect(fail.reason).toBe('enhance_failed')
    expect(slotManager.get('weapon').enhanceLevel).toBe(2)
    expect(slotManager.get('weapon').enhanceFailStreak).toBe(1)

    // Nguyên liệu lần fail ĐÃ mất (chỉ mất nguyên liệu, không phạt khác).
    const stonesAfter = materialBag.getAmount(
      requireSpiritStoneIdForLevel(materialBag),
    )

    expect(stonesAfter).toBeLessThan(stonesBefore)
  })

  it('pity: 10 fail liên tiếp → lần 11 chắc chắn thành công bất chấp random, reset streak', () => {
    const { system, bag, registry, materialBag, slotManager, affixRegistry, player } = setup({
      random: () => 0.999, // luôn fail ở mọi rate < 100
    })

    // L1 rate 100 → success (bất kể random). Từ L2 rate < 100 → fail x10.
    system.enhance('weapon', player.realmId, bag, registry, materialBag, slotManager, affixRegistry)

    for (let i = 1; i <= 10; i++) {
      const result = system.enhance('weapon', player.realmId, bag, registry, materialBag, slotManager, affixRegistry)

      expect(result.ok).toBe(false)

      expect(slotManager.get('weapon').enhanceFailStreak).toBe(i)
    }

    // Lần 11 — pity: CHẮC CHẮC thành công dù random 0.999.
    const pity = system.enhance('weapon', player.realmId, bag, registry, materialBag, slotManager, affixRegistry)

    expect(pity.ok).toBe(true)
    expect(slotManager.get('weapon').enhanceLevel).toBe(2)
    expect(slotManager.get('weapon').enhanceFailStreak).toBe(0)
  })

  it('thành công thường → reset streak về 0', () => {
    const sequence = [
      0.5, 0.5, 0.5, 0.5, // L1 success (rate 100), L2..L4 success (rate cao)
      0.999, // L5 fail (rate ~83)
      0.5, // L5 retry — success (rate ~83, 0.5 < 83) → reset
    ]

    let index = -1

    const { system, bag, registry, materialBag, slotManager, affixRegistry, player } = setup({
      random: () => {
        index += 1

        return sequence[Math.min(index, sequence.length - 1)] ?? 0.5
      },
    })

    for (let i = 0; i < 4; i++) {
      system.enhance('weapon', player.realmId, bag, registry, materialBag, slotManager, affixRegistry)
    }

    system.enhance('weapon', player.realmId, bag, registry, materialBag, slotManager, affixRegistry) // fail → streak 1
    system.enhance('weapon', player.realmId, bag, registry, materialBag, slotManager, affixRegistry) // success → reset

    expect(slotManager.get('weapon').enhanceFailStreak).toBe(0)
    expect(slotManager.get('weapon').enhanceLevel).toBe(5)
  })

  it('max_level 100: chặn khi enhanceLevel chạm MAX_SLOT_ENHANCE_LEVEL', () => {
    const { system, bag, registry, materialBag, slotManager, affixRegistry, player } = setup({
      random: () => 0.5,
    })

    const slotState = slotManager.get('weapon')

    slotState.enhanceLevel = 100 // test shortcut — không roll 100 lần

    const result = system.enhance('weapon', player.realmId, bag, registry, materialBag, slotManager, affixRegistry)

    expect(result).toEqual({ ok: false, reason: 'max_level' })
  })
})

function requireSpiritStoneIdForLevel(materialBag: MaterialBag): string {
  // Lấy id Linh Thạch đang có trong bag (mortal tier) — test không cứng
  // id, chỉ cần 1 stack spirit_stone bất kỳ.
  const stack = materialBag.getAll().find((entry) => entry.material.category === 'spirit_stone')

  if (!stack) {
    throw new Error('materials fixture thiếu spirit_stone')
  }

  return stack.material.id
}

// Guard chống regression: slot state mặc định phải có streak 0.
describe('EquipmentSlotState — enhanceFailStreak default (Task 10)', () => {
  it('createDefaultSlotState init enhanceFailStreak = 0', () => {
    expect(createDefaultSlotState('weapon').enhanceFailStreak).toBe(0)
  })
})
