// Combat Grid Rework (2026-08-24) - lane constants nay dan nguon tu
// BattleGrid.ts (10x16). File nay giu cac khai niem rieng cua lane:
// cong Hero, quy uoc cot hero.
import {
  GRID_COLUMN_COUNT,
  GRID_ROW_COUNT,
  SPAWN_COLUMN,
  VISIBLE_MAX_COLUMN,
  type LaneIndex,
} from './BattleGrid'
import { DEFAULT_PLAYER_STANDING_POSITION } from './BattlefieldRegions'

export { GRID_ROW_COUNT, GRID_COLUMN_COUNT, SPAWN_COLUMN, VISIBLE_MAX_COLUMN }
export type { LaneIndex }

// Compatibility aliases derive from the shared player standing position.
// They must not define a second formation or obsolete gate coordinate.
export const HERO_COLUMN = DEFAULT_PLAYER_STANDING_POSITION.column

// Compatibility aliases for the 10x16 renderer.
export const SCREEN_VISIBLE_MAX_X = VISIBLE_MAX_COLUMN
export const LANE_COUNT = GRID_ROW_COUNT

// Default row before a live formation snapshot supplies entity placement.
export const HERO_LANE_INDEX: LaneIndex = DEFAULT_PLAYER_STANDING_POSITION.row
export const CENTER_LANE_INDEX: LaneIndex = HERO_LANE_INDEX

// Authored data field (Enemies.ts) - KHONG anh huong runtime, chi giu
// cho schema data.
export type EnemyLane = 'underground' | 'ground' | 'air'
