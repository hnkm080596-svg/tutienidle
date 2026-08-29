import { describe, expect, it } from 'vitest'
import {
  EquipmentSystem,
  getMaxForgePoints,
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

describe('Item roll — forgePotential/forgePoints boundaries', () => {
  it('forgePotential luôn trong [0, 100] (randomInt(0, 100))', () => {
    for (let i = 0; i < 500; i++) {
      const potential = rollInstance().forgePotential

      expect(potential).toBeGreaterThanOrEqual(0)
      expect(potential).toBeLessThanOrEqual(100)
      expect(Number.isInteger(potential)).toBe(true)
    }
  })

  it('forgePoints khởi đầu ĐẦY = getMaxForgePoints(quality, forgePotential), không âm', () => {
    for (let i = 0; i < 100; i++) {
      const instance = rollInstance()

      expect(instance.forgePoints).toBe(getMaxForgePoints(instance.quality, instance.forgePotential))
      expect(instance.forgePoints).toBeGreaterThanOrEqual(0)
    }
  })

  // Edge case thật: randomInt(0, 100) INCLUSIVE của 0 — potential roll 0
  // → item mới sinh ra đã cạn Điểm Rèn (forgePoints = 0). Comment ở
  // EquipmentSystem.test.ts ("luôn > 0 với roll 1-100") không khớp miền
  // roll thật. Test này chốt hành vi hiện tại của code.
  it('forgePotential roll được 0 (miền [0,100] inclusive) → forgePoints = 0', () => {
    expect(getMaxForgePoints('pham_khi', 0)).toBe(0)
  })

  it('forgePoints không vượt trần tuyệt đối của tier quality', () => {
    for (let i = 0; i < 100; i++) {
      const instance = rollInstance()

      expect(instance.forgePoints).toBeLessThanOrEqual(
        EQUIPMENT_QUALITY_MAX_FORGE_POINTS[instance.quality],
      )
    }
  })

  it('getMaxForgePoints biên: potential 0 → 0, potential 100 → đúng trần tier, làm tròn đúng', () => {
    // Phàm Khí trần 20 — potential 50 → 10.
    expect(getMaxForgePoints('pham_khi', 0)).toBe(0)
    expect(getMaxForgePoints('pham_khi', 50)).toBe(10)
    expect(getMaxForgePoints('pham_khi', 100)).toBe(20)

    // Thiên Địa Trọng Khí trần 200.
    expect(getMaxForgePoints('thien_dia_trong_khi', 0)).toBe(0)
    expect(getMaxForgePoints('thien_dia_trong_khi', 100)).toBe(200)

    // Làm tròn: Bảo Khí trần 30, potential 50 → 15; potential 33 → 9.9 → 10.
    expect(getMaxForgePoints('bao_khi', 33)).toBe(10)
  })

  it('calculateEquipmentScale: 0/0 → 1, tuyến tính theo enhanceLevel và forgePoints', () => {
    expect(calculateEquipmentScale(0, 0)).toBe(1)
    expect(calculateEquipmentScale(10, 0)).toBe(1 + 10 * ENHANCE_PERCENT_PER_LEVEL)
    expect(calculateEquipmentScale(0, 200)).toBe(1 + 200 * FORGE_PERCENT_PER_POINT)
    expect(calculateEquipmentScale(5, 40)).toBe(1 + 5 * ENHANCE_PERCENT_PER_LEVEL + 40 * FORGE_PERCENT_PER_POINT)
  })

  it('2 instance cùng quality có thể có trần rèn khác nhau theo forgePotential roll', () => {
    const seen = new Set<number>()

    for (let i = 0; i < 200; i++) {
      seen.add(getMaxForgePoints('pham_khi', rollInstance().forgePotential))
    }

    // Random 0-100 trên trần 20 phải cho nhiều trần rèn khác nhau.
    expect(seen.size).toBeGreaterThan(5)
  })
})
