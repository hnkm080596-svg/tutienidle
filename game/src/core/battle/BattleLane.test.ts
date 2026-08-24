import { describe, expect, it } from 'vitest'
import { GRID_ROW_COUNT, GRID_COLUMN_COUNT, HERO_LANE_INDEX, HERO_COLUMN, SPAWN_COLUMN, VISIBLE_MAX_COLUMN, randomEnemyLaneIndex, attackRangeVisiblePercent } from './BattleLane'

describe('BattleLane — grid 10×16 (Combat Grid Rework)', () => {
  it('randomEnemyLaneIndex() luôn trả về hàng hợp lệ trong [0, GRID_ROW_COUNT)', () => {
    for (let i = 0; i < 200; i++) {
      const row = randomEnemyLaneIndex()
      expect(row).toBeGreaterThanOrEqual(0)
      expect(row).toBeLessThan(GRID_ROW_COUNT)
    }
  })

  it('hero gate: cột neo 0, hàng đại diện giữa sân (4/10)', () => {
    expect(HERO_COLUMN).toBe(0)
    expect(HERO_LANE_INDEX).toBe(4)
    expect(HERO_LANE_INDEX).toBeLessThan(GRID_ROW_COUNT)
  })

  it('spawn ngoài mép phải, visible max trong grid', () => {
    expect(SPAWN_COLUMN).toBe(GRID_COLUMN_COUNT)
    expect(VISIBLE_MAX_COLUMN).toBeLessThan(GRID_COLUMN_COUNT)
  })

  it('attackRangeVisiblePercent theo đơn vị CỘT', () => {
    expect(attackRangeVisiblePercent(GRID_COLUMN_COUNT)).toBe(100)
    expect(attackRangeVisiblePercent(GRID_COLUMN_COUNT / 2)).toBe(50)
    expect(attackRangeVisiblePercent(0)).toBe(0)
  })
})
