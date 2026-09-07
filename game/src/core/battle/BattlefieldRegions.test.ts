import { describe, expect, it } from 'vitest'
import {
  PLAYER_SIDE_REGION,
  ENEMY_SIDE_REGION,
  NEUTRAL_DIVIDER_COLUMN,
  DEFAULT_BATTLEFIELD_USABLE_REGION,
  centerOfRegion,
  standingSlotPosition,
  STANDING_SLOT_COUNT,
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

describe('standingSlotPosition', () => {
  it('anchors slot (0,0) at the region origin', () => {
    expect(standingSlotPosition(PLAYER_SIDE_REGION, 0, 0)).toEqual({ row: 3, column: 0 })
  })

  it('spaces slots 2 units apart on both axes', () => {
    expect(standingSlotPosition(PLAYER_SIDE_REGION, 1, 1)).toEqual({ row: 5, column: 2 })
    expect(standingSlotPosition(PLAYER_SIDE_REGION, 2, 2)).toEqual({ row: 7, column: 4 })
  })

  it('works for the enemy region using its own columnMin', () => {
    expect(standingSlotPosition(ENEMY_SIDE_REGION, 0, 0)).toEqual({ row: 3, column: 7 })
    expect(standingSlotPosition(ENEMY_SIDE_REGION, 1, 1)).toEqual({ row: 5, column: 9 })
    expect(standingSlotPosition(ENEMY_SIDE_REGION, 2, 2)).toEqual({ row: 7, column: 11 })
  })

  it('the middle slot matches centerOfRegion for both regions', () => {
    expect(standingSlotPosition(PLAYER_SIDE_REGION, 1, 1)).toEqual(centerOfRegion(PLAYER_SIDE_REGION))
    expect(standingSlotPosition(ENEMY_SIDE_REGION, 1, 1)).toEqual(centerOfRegion(ENEMY_SIDE_REGION))
  })
})

describe('STANDING_SLOT_COUNT', () => {
  it('is 3', () => {
    expect(STANDING_SLOT_COUNT).toBe(3)
  })
})
