import { describe, expect, it } from 'vitest'
import { getHitChance } from './Accuracy'
import { createBaseStats } from '../stats/StatBlock'

describe('Accuracy', () => {
  it('baseline player đạt khoảng 95% tỉ lệ trúng trước bonus thuộc tính', () => {
    const stats = createBaseStats()
    expect(getHitChance(stats.accuracyRating, stats.evasionRate)).toBeCloseTo(0.9524, 3)
  })

  it('giữ sàn 5% trước mục tiêu né cực cao', () => {
    expect(getHitChance(1, 1_000_000)).toBe(0.05)
  })

  it('cả 2 rating cùng 0 — không NaN, đòn trúng (không có gì contest)', () => {
    expect(getHitChance(0, 0)).toBe(1)
  })

  it('input NaN/âm — không lan NaN ra xác suất', () => {
    expect(Number.isNaN(getHitChance(NaN, NaN))).toBe(false)
    expect(Number.isNaN(getHitChance(0, NaN))).toBe(false)
    expect(getHitChance(-5, -5)).toBe(1)
    expect(getHitChance(50, NaN)).toBe(1)
  })
})
