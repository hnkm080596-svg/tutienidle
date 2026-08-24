// Combat Grid Rework (2026-08-24) — lane constants nay dẫn nguồn từ
// BattleGrid.ts (10×16). File này giữ các khái niệm riêng của lane:
// cổng Hero, quy tắc gán lane lúc spawn.
import {
  GRID_COLUMN_COUNT,
  GRID_ROW_COUNT,
  SPAWN_COLUMN,
  VISIBLE_MAX_COLUMN,
  type LaneIndex,
} from './BattleGrid'

export { GRID_ROW_COUNT, GRID_COLUMN_COUNT, SPAWN_COLUMN, VISIBLE_MAX_COLUMN }
export type { LaneIndex }

// Hero là CỔNG CHẮN NGANG (decision 2026-08-24): chiếm cố định các cột
// 0..HERO_GATE_COLUMNS-1 ở MỌI hàng — enemy cận chiến hàng nào cũng đánh
// được hero khi đủ rangeColumns tới cổng; targeting AOE vẫn chuẩn row/column.
export const HERO_COLUMN = 0
export const HERO_GATE_COLUMNS = 2

// Hàng đại diện để RENDER sprite hero (gate không có "tâm" hiển thị).
export const HERO_LANE_INDEX: LaneIndex = 4

// Quái thường random lane MỖI LẦN spawn trên 10 hàng; Boss luôn hàng hero.
export function randomEnemyLaneIndex(): LaneIndex {
  return Math.floor(Math.random() * GRID_ROW_COUNT) as LaneIndex
}

export function applySpawnLaneRule(entity: { isBoss?: boolean; row: LaneIndex }): void {
  entity.row = entity.isBoss ? HERO_LANE_INDEX : randomEnemyLaneIndex()
}

// Authored data field (Enemies.ts) — KHÔNG ảnh hưởng runtime
// (applySpawnLaneRule luôn ghi đè), chỉ giữ cho schema data.
export type EnemyLane = 'underground' | 'ground' | 'air'

// % tầm nhìn hiển thị cho UI — worldRange giờ đo bằng CỘT.
export function attackRangeVisiblePercent(worldRangeColumns: number): number {
  return Math.min(100, Math.round((worldRangeColumns / GRID_COLUMN_COUNT) * 100))
}
