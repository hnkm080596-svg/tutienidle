// @vitest-environment node
// Task 10 (rework P3, plan §Task 10) — EnhanceCurve: đường cong mũ
// 0.956 (spec §5.1, user-approved) + pity 10. Curve thuần, không phụ
// thuộc class — dùng chung EquipmentSystem (roll) và UI preview.
import { describe, expect, it } from 'vitest'
import {
  enhanceSuccessRate,
  ENHANCE_PITY_THRESHOLD,
  MAX_SLOT_ENHANCE_LEVEL,
  ENHANCE_SLOT_SCALE,
} from './EnhanceCurve'

describe('EnhanceCurve — success rate (Task 10)', () => {
  it('L1 = 100% (đầu realm luôn thành công)', () => {
    expect(enhanceSuccessRate(1)).toBe(100)
  })

  it('giảm theo mũ 0.956^(L-1), làm tròn nguyên', () => {
    // Khóa bằng chính công thức — tránh cứng số sai do làm tròn float.
    expect(enhanceSuccessRate(5)).toBe(Math.round(100 * 0.956 ** 4))
    expect(enhanceSuccessRate(10)).toBe(Math.round(100 * 0.956 ** 9))
    expect(enhanceSuccessRate(40)).toBe(Math.round(100 * 0.956 ** 39))

    // Dải behavior (không phụ thuộc rounding): L10 ~64%, L40 ~17%.
    expect(enhanceSuccessRate(10)).toBeGreaterThanOrEqual(60)
    expect(enhanceSuccessRate(10)).toBeLessThanOrEqual(68)
    expect(enhanceSuccessRate(40)).toBeGreaterThanOrEqual(14)
    expect(enhanceSuccessRate(40)).toBeLessThanOrEqual(20)
  })

  it('floor 1% — không bao giờ 0, kể cả L rất lớn', () => {
    expect(enhanceSuccessRate(100)).toBeGreaterThanOrEqual(1)
    expect(enhanceSuccessRate(1000)).toBe(1)
  })

  it('level < 1 coi như L1 (100%)', () => {
    expect(enhanceSuccessRate(0)).toBe(100)
    expect(enhanceSuccessRate(-5)).toBe(100)
  })

  it('kết quả luôn nằm trong [1, 100]', () => {
    for (let level = 1; level <= 100; level++) {
      const rate = enhanceSuccessRate(level)

      expect(rate).toBeGreaterThanOrEqual(1)
      expect(rate).toBeLessThanOrEqual(100)
    }
  })
})

describe('EnhanceCurve — constants (Task 10)', () => {
  it('pity threshold = 10 (user-approved "10 lần tất nhiên thành công")', () => {
    expect(ENHANCE_PITY_THRESHOLD).toBe(10)
  })

  it('max slot level = 100 (10 realm × 10 cấp)', () => {
    expect(MAX_SLOT_ENHANCE_LEVEL).toBe(100)
  })

  it('ENHANCE_SLOT_SCALE = 0.06 (giữ tổng công bằng: 0.06×100 ≈ 0.08×10×7.5)', () => {
    expect(ENHANCE_SLOT_SCALE).toBe(0.06)
  })
})
