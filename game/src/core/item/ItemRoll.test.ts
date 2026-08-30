import { describe, expect, it } from 'vitest'
import {
  EquipmentSystem,
  calculateEquipmentScale,
  ENHANCE_PERCENT_PER_LEVEL,
  FORGE_PERCENT_PER_POINT,
} from '../equipment/EquipmentSystem'
import { AffixRegistry } from '../equipment/AffixRegistry'
import { createDefaultPlayer } from '../player/Player'
import type { Equipment } from '../equipment/Equipment'
import type { EquipmentInstance } from '../equipment/EquipmentInstance'
import type { PlayerData } from '../player/Player'
import {
  EQUIPMENT_QUALITY_ORDER,
  EQUIPMENT_QUALITY_MAX_FORGE_POINTS,
} from '../equipment/EquipmentQuality'
import { EQUIPMENT_RARITY_ORDER } from '../equipment/EquipmentRarity'
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

describe('Item roll — quality theo trần cảnh giới (EQUIPMENT_QUALITY_REALM_WEIGHTS)', () => {
  it('Phàm Nhân (realm index 0) chỉ roll được Phàm Khí — 100 iterations', () => {
    for (let i = 0; i < 100; i++) {
      expect(rollInstance('mortal').quality).toBe('pham_khi')
    }
  })

  it('Luyện Khí không bao giờ roll quality vượt Bảo Khí (weight 0 chặn bậc cao hơn)', () => {
    const maxAllowed = EQUIPMENT_QUALITY_ORDER.indexOf('bao_khi')

    for (let i = 0; i < 100; i++) {
      const quality = rollInstance('qi_refining').quality

      expect(EQUIPMENT_QUALITY_ORDER.indexOf(quality)).toBeLessThanOrEqual(maxAllowed)
    }
  })

  it('mọi realm roll được quality hợp lệ nằm trong EQUIPMENT_QUALITY_ORDER', () => {
    for (const realmId of ['mortal', 'qi_refining', 'foundation_establishment', 'tribulation']) {
      for (let i = 0; i < 50; i++) {
        expect(EQUIPMENT_QUALITY_ORDER).toContain(rollInstance(realmId).quality)
      }
    }
  })

  it('realmId không tồn tại → getRealmIndex trả -1, rollQuality kẹp về index 0 (chỉ Phàm Khí)', () => {
    for (let i = 0; i < 50; i++) {
      expect(rollInstance('khong_ton_tai').quality).toBe('pham_khi')
    }
  })
})

describe('Item roll — rarity theo EQUIPMENT_RARITY_DROP_WEIGHT', () => {
  it('luôn roll rarity hợp lệ trong 5 bậc Ngũ Phẩm', () => {
    for (let i = 0; i < 300; i++) {
      expect(EQUIPMENT_RARITY_ORDER).toContain(rollInstance().rarity)
    }
  })

  it('rarity cao nhất (tien) cực hiếm nhưng hoang luôn phổ biến nhất trên mẫu lớn', () => {
    const counts = new Map<string, number>()

    for (let i = 0; i < 2000; i++) {
      const rarity = rollInstance().rarity

      counts.set(rarity, (counts.get(rarity) ?? 0) + 1)
    }

    const hoang = counts.get('hoang') ?? 0
    const tien = counts.get('tien') ?? 0

    // Trọng số 55/100 vs 1/100 — biên đủ rộng để không flaky.
    expect(hoang).toBeGreaterThan(2000 * 0.35)
    expect(tien).toBeLessThan(2000 * 0.05)
  })
})

describe('Item roll — forgePoints theo quality (rework 2026-08-30, bỏ potential roll)', () => {
  it('forgePoints khởi đầu ĐẦY = ĐÚNG trần quality, không còn random', () => {
    for (let i = 0; i < 100; i++) {
      const instance = rollInstance()

      expect(instance.forgePoints).toBe(EQUIPMENT_QUALITY_MAX_FORGE_POINTS[instance.quality])
    }
  })

  it('forgePotential không còn roll ngẫu nhiên — item mới luôn 100 (field giữ cho save cũ)', () => {
    for (let i = 0; i < 100; i++) {
      expect(rollInstance().forgePotential).toBe(100)
    }
  })

  it('forgePoints Phàm Nhân luôn 20 (trần Phàm Khí — realm này chỉ roll được pham_khi)', () => {
    for (let i = 0; i < 50; i++) {
      expect(rollInstance('mortal').forgePoints).toBe(20)
    }
  })

  it('calculateEquipmentScale: 0/0 → 1, tuyến tính theo enhanceLevel và forgePoints', () => {
    expect(calculateEquipmentScale(0, 0)).toBe(1)
    expect(calculateEquipmentScale(10, 0)).toBe(1 + 10 * ENHANCE_PERCENT_PER_LEVEL)
    expect(calculateEquipmentScale(0, 200)).toBe(1 + 200 * FORGE_PERCENT_PER_POINT)
    expect(calculateEquipmentScale(5, 40)).toBe(1 + 5 * ENHANCE_PERCENT_PER_LEVEL + 40 * FORGE_PERCENT_PER_POINT)
  })

  it('2 instance cùng quality LUÔN có cùng trần rèn (không còn random theo potential)', () => {
    const seen = new Set<number>()

    for (let i = 0; i < 200; i++) {
      seen.add(rollInstance().forgePoints)
    }

    // Phàm Nhân chỉ roll được pham_khi (trần 20) — mọi instance cùng số.
    expect(seen.size).toBe(1)
  })
})
