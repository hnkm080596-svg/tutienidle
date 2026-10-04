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

export { GRID_ROW_COUNT, GRID_COLUMN_COUNT, SPAWN_COLUMN, VISIBLE_MAX_COLUMN }
export type { LaneIndex }

// Player la CONG PHONG THU + avatar tan cong (plan sec2.2): cong phu toan
// bo 10 hang TAI COT HERO_COLUMN - quai tan cong cong khong xet row hien
// tai cua avatar va khong duoc vuot qua cong. Avatar Player co row that,
// column luon giu HERO_COLUMN (teleport chi doi row).
export const HERO_COLUMN = 1

// Compatibility aliases for the 10x16 renderer.
export const SCREEN_VISIBLE_MAX_X = VISIBLE_MAX_COLUMN
export const LANE_COUNT = GRID_ROW_COUNT

// Hang khoi dau cua avatar Player khi bat dau tran (plan sec2.1).
export const HERO_LANE_INDEX: LaneIndex = 4
export const CENTER_LANE_INDEX: LaneIndex = HERO_LANE_INDEX

// Authored data field (Enemies.ts) - KHONG anh huong runtime, chi giu
// cho schema data.
export type EnemyLane = 'underground' | 'ground' | 'air'
