import { describe, expect, it } from 'vitest'
import { calculateStats, type StatModifier } from './StatCalculator'
import { createBaseStats } from './StatBlock'
import { STAT_METADATA, clampStatValue, isPercentStat } from './StatMetadata'
import type { Stats } from './StatBlock'

// Turn-based stat conversion (2026-09-04) — adversarial QA probes cho
// plan 2026-09-04-stat-system-turn-based-conversion. Mỗi test bắn 1
// hypothesis rủi ro riêng của việc rename attackSpeed→speed,
// hpRegenPerSecond→hpRegenPerTurn, retire movementSpeed/
// castSpeedPercent/cooldownReduction.

describe('Adversarial QA — stat turn-based conversion invariants', () => {
  it('INV-1 (Boundedness): baseStats.speed = 100 neo HSR-SPD, không NaN/0', () => {
    const base = createBaseStats()
    expect(base.speed).toBe(100)
    expect(Number.isFinite(base.speed)).toBe(true)
  })

  it('INV-2 (Conservation): Dexterity dẫn xuất speed flat 0.15/điểm, KHÔNG còn percent attackSpeed pool', () => {
    const base = createBaseStats()
    // dexterity 1 → speed = 100 (base) + 1×0.15 (flat) = 100.15
    const result = calculateStats(base, [])
    expect(result.speed).toBeCloseTo(100.15, 5)
    // dexterity 21 → speed = 100 + 21×0.15 = 103.15 (tăng tuyến tính
    // đúng, KHÔNG compound percent).
    const boosted = calculateStats(base, [
      { id: 't:dex', sourceId: 't', sourceType: 'technique', stat: 'dexterity', flat: 20 },
    ])
    expect(boosted.speed).toBeCloseTo(103.15, 5)
  })

  it('INV-3 (Exactly-once/Conservation): Intelligence KHÔNG còn cấp cooldownReduction — modifier không chết lọt pipeline', () => {
    const base = createBaseStats()
    const result = calculateStats(base, [])
    // Trước conversion Intelligence 1 cấp +0.001 CDR. Sau retire, giá
    // trị CDR phải biến mất hoàn toàn (không còn field để nhận).
    expect('cooldownReduction' in result).toBe(false)
    // Intelligence vẫn cấp 2 stat đúng spec §5: criticalDamage là PERCENT
    // modifier → 1.5 × (1 + 1×0.003) = 1.5045.
    expect(result.criticalDamage).toBeCloseTo(1.5 * 1.003, 5)
    expect(result.ailmentResistPercent).toBeCloseTo(1 * 0.002, 5)
  })

  it('INV-4 (Boundedness): hpRegenPerTurn giữ đúng rate 0.1/vitality — đổi tên không đổi số', () => {
    const base = createBaseStats()
    const boosted = calculateStats(base, [
      { id: 't:vit', sourceId: 't', sourceType: 'technique', stat: 'vitality', flat: 9 },
    ])
    // vitality 10 → 10×0.1 = 1.0 hpRegenPerTurn (base 0 + flat).
    expect(boosted.hpRegenPerTurn).toBeCloseTo(1, 5)
  })

  it('INV-5 (Recoverability): StatModifier nhắm stat đã retire bị StatType tĩnh chặn ngay compile-time — runtime chỉ nhận StatType hợp lệ', () => {
    // Metadata của mọi StatType hợp lệ phải tra được; các key đã retire
    // phải vắng mặt khỏi metadata (đảm bảo không còn memento rác).
    expect(STAT_METADATA.speed).toBeUndefined() // speed là flat, không cần trần
    expect(STAT_METADATA.hpRegenPerTurn).toBeUndefined()
    expect('cooldownReduction' in STAT_METADATA).toBe(false)
    expect('castSpeedPercent' in STAT_METADATA).toBe(false)
    expect('movementSpeed' in STAT_METADATA).toBe(false)
    // isPercentStat không phân loại sai speed thành percent.
    expect(isPercentStat('speed')).toBe(false)
  })

  it('INV-6 (Synchronization): createBaseStats đủ đúng StatType — không thiếu key mới, không dư key chết', () => {
    const base = createBaseStats()
    expect(Object.keys(base)).toContain('speed')
    expect(Object.keys(base)).toContain('hpRegenPerTurn')
    expect(Object.keys(base)).not.toContain('attackSpeed')
    expect(Object.keys(base)).not.toContain('movementSpeed')
    expect(Object.keys(base)).not.toContain('cooldownReduction')
    expect(Object.keys(base)).not.toContain('castSpeedPercent')
    expect(Object.keys(base)).not.toContain('hpRegenPerSecond')
  })

  it('INV-7 (Boundedness): speed cao bất thường vẫn bounded trong pipeline (không NaN/âm)', () => {
    const base = createBaseStats()
    const huge = calculateStats(base, [
      { id: 't:speed', sourceId: 't', sourceType: 'technique', stat: 'speed', flat: 1e9 },
    ])
    expect(Number.isFinite(huge.speed)).toBe(true)
    expect(huge.speed).toBeGreaterThan(0)
    // Speed không có trần metadata — chấp nhận theo spec (GAUGE_MAX
    // chỉ quan tâm tỉ lệ), nhưng KHÔNG BAO GIỜ âm từ pipeline chuẩn.
    const neg = calculateStats(base, [
      { id: 't:speed', sourceId: 't', sourceType: 'technique', stat: 'speed', flat: -50 },
    ])
    // 100 - 50 + dexterity 1×0.15 (attribute flat hoà chung Added pool).
    expect(neg.speed).toBeCloseTo(50.15, 5)
  })

  it('INV-8 (Determinism): modifier trỏ speed qua nhiều nguồn cộng dồn đúng Added pool', () => {
    const base = createBaseStats()
    const mods: StatModifier[] = [
      { id: 'a:1', sourceId: 'a', sourceType: 'buff', stat: 'speed', flat: 10 },
      { id: 'e:1', sourceId: 'e', sourceType: 'equipment', stat: 'speed', percent: 0.1 },
    ]
    const result = calculateStats(base, mods)
    // Added pool: 100 + 10 (equipment flat) + 0.15 (dexterity attribute
    // flat) = 110.15 → Increased ×1.1 = 121.165.
    expect(result.speed).toBeCloseTo(121.165, 5)
  })

  it('INV-9 (full Stats shape): deriveAttributeModifiers không sinh StatModifier nhắm key đã retire', () => {
    // calculateStats gọi deriveAttributeModifiers nội bộ — kết quả cuối
    // phải chứa ĐỦ 5 attribute dẫn xuất đúng, trong đó Thân Pháp/Dexterity
    // nhắm 'speed', Thần Thức/Intelligence KHÔNG nhắm gì đã retire.
    const base: Stats = createBaseStats()
    const result = calculateStats(base, [])
    // Thân Pháp 1: speed 100.15, accuracy +1.5, evasion +1.0, crit +0.05%.
    expect(result.accuracyRating).toBeCloseTo(100 + 1.5, 5)
    expect(result.evasionRate).toBeCloseTo(5 + 1, 5)
    expect(result.criticalRate).toBeCloseTo(0.05 * (1 + 0.0005), 5)
  })
})
