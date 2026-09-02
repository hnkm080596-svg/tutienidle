import { describe, expect, it } from 'vitest'
import {
  EquipmentSystem,
  calculateEquipmentScale,
} from '../equipment/EquipmentSystem'
import { ENHANCE_SLOT_SCALE } from '../equipment/EnhanceCurve'
import { AffixRegistry } from '../equipment/AffixRegistry'
import { createDefaultPlayer } from '../player/Player'
import type { Equipment } from '../equipment/Equipment'
import type { EquipmentInstance } from '../equipment/EquipmentInstance'
import type { PlayerData } from '../player/Player'
import { ITEM_QUALITY_ORDER } from './ItemQuality'
import { ITEM_QUALITY_FORGE_USES } from '../equipment/ItemQualityBalance'
import { affixes } from '@/data/equipment/affixes'

// Roll logic phẩm chất/độ hiếm sống ở EquipmentSystem (thư mục
// equipment), không phải src/core/item/ — src/core/item chỉ giữ type
// chung (Item/ItemGrade/ItemRegistry). Test này phủ đúng phần roll
// quality/rarity/forgePotential mà task yêu cầu.

const TEMPLATE: Equipment = {
  id: 'item_roll_test_sword',
  name: 'Kiểm Đao',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'attack', min: 10, max: 20 }],
  enhanceCost: [],
}

function makePlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return { ...createDefaultPlayer(), ...overrides }
}

function setup(realmId = 'mortal') {
  const system = new EquipmentSystem()
  const affixRegistry = new AffixRegistry()

  for (const affix of affixes) {
    affixRegistry.register(affix)
  }

  return { system, affixRegistry, player: makePlayer({ realmId }) }
}

function rollInstance(realmId = 'mortal'): EquipmentInstance {
  const { system, affixRegistry, player } = setup(realmId)

  return system.createInstance(TEMPLATE, player, affixRegistry)
}

describe('Item roll — EquipmentInstance schema bridge', () => {
  it('mọi realm hợp lệ trả quality mới trong ITEM_QUALITY_ORDER', () => {
    for (const realmId of ['mortal', 'qi_refining', 'foundation_establishment', 'tribulation']) {
      for (let i = 0; i < 50; i++) {
        expect(ITEM_QUALITY_ORDER).toContain(rollInstance(realmId).quality)
      }
    }
  })

  it('realm không có ProfessionGrade bị từ chối thay vì tạo instance thiếu grade', () => {
    expect(() => rollInstance('khong_ton_tai')).toThrow(
      'Missing profession grade for equipment realm khong_ton_tai',
    )
  })
})

describe('Item roll — quality bridge theo roll rarity cũ', () => {
  it('luôn roll quality hợp lệ trong 5 bậc', () => {
    for (let i = 0; i < 300; i++) {
      expect(ITEM_QUALITY_ORDER).toContain(rollInstance().quality)
    }
  })

  it('quality cao nhất (tien) hiếm nhưng hoang phổ biến nhất trên mẫu lớn', () => {
    const counts = new Map<string, number>()

    for (let i = 0; i < 2000; i++) {
      const rarity = rollInstance().quality

      counts.set(rarity, (counts.get(rarity) ?? 0) + 1)
    }

    const hoang = counts.get('hoang') ?? 0
    const tien = counts.get('tien') ?? 0

    // Trọng số 55/100 vs 1/100 — biên đủ rộng để không flaky.
    expect(hoang).toBeGreaterThan(2000 * 0.35)
    expect(tien).toBeLessThan(2000 * 0.05)
  })
})

describe('Item roll — forgeUses theo quality', () => {
  it('forgeUses khởi đầu đầy và đúng bảng quality', () => {
    for (let i = 0; i < 100; i++) {
      const instance = rollInstance()

      expect(instance.forgeUsesTotal).toBe(ITEM_QUALITY_FORGE_USES[instance.quality])
      expect(instance.forgeUsesRemaining).toBe(instance.forgeUsesTotal)
    }
  })

  it('calculateEquipmentScale: 0 → 1, slot-only tuyến tính theo enhanceLevel (Task 10)', () => {
    expect(calculateEquipmentScale(0)).toBe(1)
    expect(calculateEquipmentScale(10)).toBe(1 + 10 * ENHANCE_SLOT_SCALE)
    expect(calculateEquipmentScale(100)).toBe(1 + 100 * ENHANCE_SLOT_SCALE)
  })

})
