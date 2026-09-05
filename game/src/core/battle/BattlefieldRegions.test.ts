import { describe, expect, it } from 'vitest'
import {
  PLAYER_SIDE_REGION,
  ENEMY_SIDE_REGION,
  NEUTRAL_DIVIDER_COLUMN,
  DEFAULT_BATTLEFIELD_USABLE_REGION,
  centerOfRegion,
} from './BattlefieldRegions'

describe('BattlefieldRegions', () => {
  it('player side is rows 3-8, columns 0-5', () => {
    expect(PLAYER_SIDE_REGION).toEqual({ rowMin: 3, rowMax: 8, columnMin: 0, columnMax: 5 })
  })

  it('enemy side is rows 3-8, columns 7-12', () => {
    expect(ENEMY_SIDE_REGION).toEqual({ rowMin: 3, rowMax: 8, columnMin: 7, columnMax: 12 })
  })

  it('column 6 is the neutral divider, excluded from both sides', () => {
    expect(NEUTRAL_DIVIDER_COLUMN).toBe(6)
    expect(PLAYER_SIDE_REGION.columnMax).toBeLessThan(NEUTRAL_DIVIDER_COLUMN)
    expect(ENEMY_SIDE_REGION.columnMin).toBeGreaterThan(NEUTRAL_DIVIDER_COLUMN)
  })

  it('bounding box spans both sides plus the divider', () => {
    expect(DEFAULT_BATTLEFIELD_USABLE_REGION).toEqual({ rowMin: 3, rowMax: 8, columnMin: 0, columnMax: 12 })
  })

  it('centerOfRegion floors to the nearest cell', () => {
    expect(centerOfRegion(ENEMY_SIDE_REGION)).toEqual({ row: 5, column: 9 })
    expect(centerOfRegion(PLAYER_SIDE_REGION)).toEqual({ row: 5, column: 2 })
  })
})
