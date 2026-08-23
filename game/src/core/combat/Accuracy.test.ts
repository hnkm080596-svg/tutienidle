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
})
