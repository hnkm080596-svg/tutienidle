// Battlefield region redesign (2026-09-05, Combat Art Pipeline spec §6) —
// battlefield is two 6x6 boxes (player/enemy), sharing rows 3-8, split by
// a neutral divider column neither side may occupy. Distance/targeting/AoE
// math is UNCHANGED — this only constrains WHERE entities may be placed.
import type { GridPosition, LaneIndex } from './BattleGrid'

export interface BattlefieldUsableRegion {
  rowMin: LaneIndex
  rowMax: LaneIndex
  columnMin: number
  columnMax: number
}

const BATTLEFIELD_ROW_RANGE = { rowMin: 3 as LaneIndex, rowMax: 8 as LaneIndex }

export const PLAYER_SIDE_REGION: BattlefieldUsableRegion = {
  ...BATTLEFIELD_ROW_RANGE,
  columnMin: 0,
  columnMax: 5,
}

export const NEUTRAL_DIVIDER_COLUMN = 6

export const ENEMY_SIDE_REGION: BattlefieldUsableRegion = {
  ...BATTLEFIELD_ROW_RANGE,
  columnMin: 7,
  columnMax: 12,
}

/** Bounding box of both sides + the divider — for camera/projection fit, NOT entity placement. */
export const DEFAULT_BATTLEFIELD_USABLE_REGION: BattlefieldUsableRegion = {
  ...BATTLEFIELD_ROW_RANGE,
  columnMin: 0,
  columnMax: 12,
}

export function centerOfRegion(region: BattlefieldUsableRegion): GridPosition {
  return {
    row: Math.floor((region.rowMin + region.rowMax) / 2) as LaneIndex,
    column: Math.floor((region.columnMin + region.columnMax) / 2),
  }
}
