import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAYER_STANDING_POSITION } from './BattlefieldRegions'
import {
  GRID_ROW_COUNT,
  GRID_COLUMN_COUNT,
  HERO_LANE_INDEX,
  HERO_COLUMN,
  SPAWN_COLUMN,
  VISIBLE_MAX_COLUMN,
} from './BattleLane'

describe('BattleLane — grid 10×16 (Combat Grid Rework)', () => {
  it('presentation aliases share the center standing position with gameplay', () => {
    expect(HERO_COLUMN).toBe(DEFAULT_PLAYER_STANDING_POSITION.column)
    expect(HERO_LANE_INDEX).toBe(DEFAULT_PLAYER_STANDING_POSITION.row)
    expect(HERO_LANE_INDEX).toBeLessThan(GRID_ROW_COUNT)
  })

  it('spawn ngoài mép phải, visible max trong grid', () => {
    expect(SPAWN_COLUMN).toBe(GRID_COLUMN_COUNT)
    expect(VISIBLE_MAX_COLUMN).toBeLessThan(GRID_COLUMN_COUNT)
  })
})
