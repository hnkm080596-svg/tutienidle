import { describe, expect, it } from 'vitest'
import { LANE_COUNT, HERO_LANE_INDEX, randomEnemyLaneIndex, attackRangeVisiblePercent, SCREEN_VISIBLE_MAX_X } from './BattleLane'

describe('BattleLane — top-down 5-lane (2026-08-22)', () => {
  it('randomEnemyLaneIndex() luôn trả về giá trị hợp lệ trong [0, LANE_COUNT)', () => {
    for (let i = 0; i < 500; i++) {
      const lane = randomEnemyLaneIndex()

      expect(lane).toBeGreaterThanOrEqual(0)
      expect(lane).toBeLessThan(LANE_COUNT)
      expect(Number.isInteger(lane)).toBe(true)
    }
  })

  it('HERO_LANE_INDEX là lane thứ 3 (tính từ 1) = index 2, nằm giữa 0..LANE_COUNT-1', () => {
    expect(HERO_LANE_INDEX).toBe(2)
    expect(LANE_COUNT).toBe(5)
  })
})

describe('BattleLane — attackRangeVisiblePercent() (2026-08-22)', () => {
  it('range = SCREEN_VISIBLE_MAX_X → 100%', () => {
    expect(attackRangeVisiblePercent(SCREEN_VISIBLE_MAX_X)).toBe(100)
  })

  it('range = 0 → 0%', () => {
    expect(attackRangeVisiblePercent(0)).toBe(0)
  })

  it('range "vô hạn" (999999, kiểu player) vẫn bị CHẶN TRẦN ở 100%, không vượt quá', () => {
    expect(attackRangeVisiblePercent(999999)).toBe(100)
  })

  it('range = nửa SCREEN_VISIBLE_MAX_X → 50%', () => {
    expect(attackRangeVisiblePercent(SCREEN_VISIBLE_MAX_X / 2)).toBe(50)
  })
})
