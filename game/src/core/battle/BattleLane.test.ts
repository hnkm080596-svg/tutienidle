import { describe, expect, it } from 'vitest'
import {
  GRID_ROW_COUNT,
  GRID_COLUMN_COUNT,
  HERO_LANE_INDEX,
  HERO_COLUMN,
  SPAWN_COLUMN,
  VISIBLE_MAX_COLUMN,
  attackRangeVisiblePercent,
} from './BattleLane'

describe('BattleLane — grid 10×16 (Combat Grid Rework)', () => {
  it('hero gate: cột cổng 1, hàng khởi đầu avatar giữa sân (4/10)', () => {
    expect(HERO_COLUMN).toBe(1)
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
