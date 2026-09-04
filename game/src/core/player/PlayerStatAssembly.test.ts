import { describe, expect, it } from 'vitest'
import { calculateStats, type StatModifier } from '../stats/StatCalculator'
import { createBaseStats } from '../stats/StatBlock'
import { clampStatValue } from '../stats/StatMetadata'
import { getMainStatCap } from '../stats/StatCap'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer, playerToCombatEntity } from './Player'

function makeModifier(overrides: Partial<StatModifier> = {}): StatModifier {
  return {
    id: 'test_modifier',
    sourceId: 'test_source',
    sourceType: 'equipment',
    stat: 'attack',
    ...overrides,
  }
}

describe('calculateStats — cộng dồn base + StatModifier', () => {
  it('flat cộng thẳng vào base (added trước increased)', () => {
    const base = createBaseStats()

    const result = calculateStats(base, [makeModifier({ flat: 15 })])

    // attribute-derived: strength 1 × 0.6 = +0.6 attack ở pass 2.
    expect(result.attack).toBeCloseTo(25.6, 5)
  })

  it('percent cộng dồn cùng pool RỒI mới nhân 1 lần (không compound)', () => {
    const base = createBaseStats()

    const result = calculateStats(base, [
      makeModifier({ percent: 0.2 }),
      makeModifier({ percent: 0.2 }),
    ])

    // (10 + 0.6) × (1 + 0.2 + 0.2) = 10.6 × 1.4 = 14.84.
    expect(result.attack).toBeCloseTo(14.84, 5)
  })

  it('multiplier (More) nhân TUẦN TỰ từng cái', () => {
    const base = createBaseStats()

    const result = calculateStats(base, [
      makeModifier({ multiplier: 1.2 }),
      makeModifier({ multiplier: 1.2 }),
    ])

    // (10 + 0.6) × 1.2 × 1.2 = 15.264.
    expect(result.attack).toBeCloseTo(15.264, 5)
  })

  it('flat + percent + multiplier kết hợp đúng thứ tự Added → Increased → More', () => {
    const base = createBaseStats()

    const result = calculateStats(base, [
      makeModifier({ flat: 10 }),
      makeModifier({ percent: 0.5 }),
      makeModifier({ multiplier: 2 }),
    ])

    // (10 + 10 + 0.6) × (1 + 0.5) × 2 = 20.6 × 1.5 × 2 = 61.8.
    expect(result.attack).toBeCloseTo(61.8, 5)
  })

  it('percent tách tag: mỗi tag là 1 pool Increased RIÊNG nhân độc lập', () => {
    const base = createBaseStats()

    const result = calculateStats(base, [
      makeModifier({ percent: 0.2, tag: 'fire' }),
      makeModifier({ percent: 0.2 }), // untagged → pool chung
    ])

    // (10 + 0.6) × (1 + 0.2) × (1 + 0.2) = 10.6 × 1.2 × 1.2 = 15.264,
    // KHÔNG phải 10.6 × 1.4.
    expect(result.attack).toBeCloseTo(15.264, 5)
  })

  it('stacks nhân vào flat/percent và lặp lại multiplier', () => {
    const base = createBaseStats()

    const result = calculateStats(base, [
      makeModifier({ flat: 5, stacks: 3 }),
      makeModifier({ percent: 0.1, stacks: 3 }),
    ])

    // (10 + 0.6 + 15) × (1 + 0.3) = 25.6 × 1.3 = 33.28.
    expect(result.attack).toBeCloseTo(33.28, 5)
  })

  it('attribute dẫn xuất: tăng vitality → maxHp/hpRegen phái sinh', () => {
    const base = createBaseStats()

    const result = calculateStats(base, [makeModifier({ stat: 'vitality', flat: 10 })])

    // pass1 vitality = 1 + 10 = 11 → +88 maxHp, +1.1 hpRegen, +11 endurance.
    expect(result.maxHp).toBeCloseTo(188, 5)
    expect(result.hpRegenPerTurn).toBeCloseTo(1.1, 5)
    expect(result.enduranceThreshold).toBeCloseTo(21, 5)
  })

  it('không modifier → base giữ nguyên cộng đúng attribute baseline', () => {
    const base = createBaseStats()

    const result = calculateStats(base, [])

    expect(result.maxHp).toBeCloseTo(108, 5) // vitality 1 × 8
    expect(result.attack).toBeCloseTo(10.6, 5) // strength 1 × 0.6
    expect(result.defense).toBeCloseTo(5.4, 5) // strength 1 × 0.4
  })
})

describe('clampStatValue — tôn trọng min/max trong StatMetadata', () => {
  it('giá trị vượt trần bị kẹp về max', () => {
    expect(clampStatValue('criticalRate', 2)).toBe(1)
    expect(clampStatValue('blockChance', 2)).toBe(0.75)
    expect(clampStatValue('manaShieldPercent', 2)).toBe(0.8)
    expect(clampStatValue('leechPercent', 2)).toBe(0.25)
  })

  it('giá trị dưới min bị kẹp lên min', () => {
    expect(clampStatValue('criticalRate', -1)).toBe(0)
    expect(clampStatValue('finalDamageReductionPercent', -1)).toBe(0)
    expect(clampStatValue('finalDamagePercent', -2)).toBe(-1)
    expect(clampStatValue('accuracyRating', -5)).toBe(0)
  })

  it('giá trị trong khoảng min/max giữ nguyên', () => {
    expect(clampStatValue('criticalRate', 0.5)).toBe(0.5)
    expect(clampStatValue('leechPercent', 0.1)).toBe(0.1)
    expect(clampStatValue('blockChance', 0.5)).toBe(0.5)
  })

  it('stat không có metadata (flat, không trần) trả về nguyên giá trị', () => {
    expect(clampStatValue('attack', -100)).toBe(-100)
    expect(clampStatValue('maxHp', 12345)).toBe(12345)
    expect(clampStatValue('firePower', 999)).toBe(999)
  })
})

describe('getMainStatCap + allocateAttributePoint — trần theo cảnh giới', () => {
  it('trần mỗi đại cảnh giới theo bảng tay: Phàm Nhân 10 / Luyện Khí 30 / Trúc Cơ 100', () => {
    expect(getMainStatCap('mortal')).toBe(10)
    expect(getMainStatCap('qi_refining')).toBe(30)
    expect(getMainStatCap('foundation_establishment')).toBe(100)
  })

  it('cảnh giới chưa có số liệu tay: neo Trúc Cơ 100, nhân đôi mỗi đại cảnh giới', () => {
    // golden_core = index 3, anchor index 2 → 100 × 2^(3-2) = 200.
    expect(getMainStatCap('golden_core')).toBe(200)
    // nascent_soul = index 4 → 400.
    expect(getMainStatCap('nascent_soul')).toBe(400)
  })

  it('allocateAttributePoint chặn ở trần: không tiêu điểm, không vượt trần', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    player.realmId = 'mortal'
    player.attributePoints = 100
    player.baseStats.strength = getMainStatCap('mortal') - 1

    expect(gameManager.allocateAttributePoint(player, 'strength')).toBe(true)
    expect(player.baseStats.strength).toBe(getMainStatCap('mortal'))

    const pointsBefore = player.attributePoints

    expect(gameManager.allocateAttributePoint(player, 'strength')).toBe(false)
    expect(player.baseStats.strength).toBe(getMainStatCap('mortal'))
    expect(player.attributePoints).toBe(pointsBefore)
  })

  it('allocateAttributePoint không tiêu điểm khi hết điểm', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    player.realmId = 'mortal'
    player.attributePoints = 0
    player.baseStats.strength = 1

    expect(gameManager.allocateAttributePoint(player, 'strength')).toBe(false)
    expect(player.baseStats.strength).toBe(1)
  })
})

describe('playerToCombatEntity — map PlayerData → CombatEntity', () => {
  it('map đúng hp/mp từ stats và realmIndex từ realmId', () => {
    const player = createDefaultPlayer()
    const stats = calculateStats(player.baseStats, player.modifiers)

    const entity = playerToCombatEntity(player, stats)

    expect(entity.id).toBe('player')
    expect(entity.type).toBe('player')
    expect(entity.name).toBe(player.name)
    expect(entity.maxHp).toBe(stats.maxHp)
    expect(entity.currentHp).toBe(stats.maxHp)
    expect(entity.currentMp).toBe(stats.maxMp)
    expect(entity.stats).toBe(stats)
    expect(entity.baseStats).toBe(stats)
    expect(entity.alive).toBe(true)
  })

  it('realmIndex theo REALMS: mortal = 0, golden_core = 3', () => {
    const player = createDefaultPlayer()
    const stats = calculateStats(player.baseStats, player.modifiers)

    player.realmId = 'mortal'
    expect(playerToCombatEntity(player, stats).realmIndex).toBe(0)

    player.realmId = 'golden_core'
    expect(playerToCombatEntity(player, stats).realmIndex).toBe(3)
  })

  it('breakthroughGrade giữ nguyên từ PlayerData', () => {
    const player = createDefaultPlayer()
    const stats = calculateStats(player.baseStats, player.modifiers)

    player.breakthroughGrade = 3

    expect(playerToCombatEntity(player, stats).breakthroughGrade).toBe(3)
  })
})
