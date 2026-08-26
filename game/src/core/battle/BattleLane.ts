// Combat Grid Rework (2026-08-24) — lane constants nay dẫn nguồn từ
// BattleGrid.ts (10×16). File này giữ các khái niệm riêng của lane:
// cổng Hero, quy ước cột hero.
import {
  GRID_COLUMN_COUNT,
  GRID_ROW_COUNT,
  SPAWN_COLUMN,
  VISIBLE_MAX_COLUMN,
  type LaneIndex,
} from './BattleGrid'

export { GRID_ROW_COUNT, GRID_COLUMN_COUNT, SPAWN_COLUMN, VISIBLE_MAX_COLUMN }
export type { LaneIndex }

// Player là CỔNG PHÒNG THỦ + avatar tấn công (plan §2.2): cổng phủ toàn
// bộ 10 hàng TẠI CỘT HERO_COLUMN — quái tấn công cổng không xét row hiện
// tại của avatar và không được vượt qua cổng. Avatar Player có row thật,
// column luôn giữ HERO_COLUMN (teleport chỉ đổi row).
export const HERO_COLUMN = 1

// Compatibility aliases for the 10×16 renderer.
export const SCREEN_VISIBLE_MAX_X = VISIBLE_MAX_COLUMN
export const LANE_COUNT = GRID_ROW_COUNT

// Hàng khởi đầu của avatar Player khi bắt đầu trận (plan §2.1).
export const HERO_LANE_INDEX: LaneIndex = 4
export const CENTER_LANE_INDEX: LaneIndex = HERO_LANE_INDEX

// Authored data field (Enemies.ts) — KHÔNG ảnh hưởng runtime, chỉ giữ
// cho schema data.
export type EnemyLane = 'underground' | 'ground' | 'air'

// % tầm nhìn hiển thị cho UI — worldRange giờ đo bằng CỘT.
export function attackRangeVisiblePercent(worldRangeColumns: number): number {
  return Math.min(100, Math.round((worldRangeColumns / GRID_COLUMN_COUNT) * 100))
}
