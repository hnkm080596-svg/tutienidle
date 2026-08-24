import { describe, expect, it } from 'vitest'
import { getAttackIntervalSeconds, MIN_ATTACKS_PER_SECOND } from './AttackTiming'

describe('getAttackIntervalSeconds', () => {
  it('attack speed 1 tạo interval 1 giây', () => {
    expect(getAttackIntervalSeconds(1)).toBe(1)
  })

  it('attack speed 2 tạo interval 0.5 giây', () => {
    expect(getAttackIntervalSeconds(2)).toBe(0.5)
  })

  it('attack speed 0.7 tạo interval lớn hơn 1 giây (làm chậm phải có tác dụng)', () => {
    expect(getAttackIntervalSeconds(0.7)).toBeGreaterThan(1)
    expect(getAttackIntervalSeconds(0.7)).toBeCloseTo(1 / 0.7)
  })

  it('attack speed 0 hoặc âm được clamp an toàn (không chia cho 0/số âm)', () => {
    expect(getAttackIntervalSeconds(0)).toBe(1 / MIN_ATTACKS_PER_SECOND)
    expect(getAttackIntervalSeconds(-5)).toBe(1 / MIN_ATTACKS_PER_SECOND)
    expect(Number.isFinite(getAttackIntervalSeconds(0))).toBe(true)
  })

  it('interval càng nhỏ khi attack speed càng lớn (đơn điệu giảm)', () => {
    expect(getAttackIntervalSeconds(5)).toBeLessThan(getAttackIntervalSeconds(2))
    expect(getAttackIntervalSeconds(2)).toBeLessThan(getAttackIntervalSeconds(1))
  })
})
