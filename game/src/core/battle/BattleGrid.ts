// Combat Grid Rework (2026-08-24) — nguồn DUY NHẤT cho hệ tọa độ chiến
// trường dạng lưới vuông 10 hàng × 16 cột.
//
// Nguyên tắc:
// - `row` (LaneIndex) là giá trị RỜI RẠC — chính là lane.
// - Entity giữ `x` LIÊN TỤC đo bằng ĐƠN VỊ CỘT (column units): quái di
//   chuyển mượt, column chiếm chỗ = làm tròn x tại thời điểm query/impact.
// - Renderer tự scale đồng đều để ô luôn VUÔNG (không kéo chữ nhật);
//   viewport lệch tỉ lệ xử lý bằng letterbox/padding, không đụng logic.
// - Core KHÔNG biết pixel — mọi khoảng cách combat (range/AOE) tính bằng
//   cột/hàng qua BattleGrid.
export const GRID_ROW_COUNT = 10
export const GRID_COLUMN_COUNT = 16

// Quái spawn NGOÀI mép phải grid (offscreen) rồi đi vào.
export const SPAWN_COLUMN = GRID_COLUMN_COUNT

// Cột xa nhất còn tính là "trong tầm nhìn" (mirror semantics cũ của
// SCREEN_VISIBLE_MAX_X: spawn phải nằm ngoài mốc này).
export const VISIBLE_MAX_COLUMN = GRID_COLUMN_COUNT - 0.5

/**
 * Hàng rời rạc 0..GRID_ROW_COUNT-1 — trùng khái niệm lane cũ nhưng mở
 * rộng từ 5 lên 10 hàng (grid vuông 16×10).
 */
export type LaneIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface GridPosition {
  row: LaneIndex
  column: number
}

/** Tâm ô theo đơn vị cột/hàng (dùng cho renderer neo VFX/tween). */
export interface WorldPoint {
  x: number
  y: number
}

export function isValidLane(value: number): value is LaneIndex {
  return Number.isInteger(value) && value >= 0 && value < GRID_ROW_COUNT
}

/** y liên tục (đơn vị hàng) → row rời rạc, clamp trong grid. */
export function getLaneFromWorldY(y: number): LaneIndex {
  const row = Math.floor(y)
  if (row < 0) return 0
  if (row >= GRID_ROW_COUNT) return (GRID_ROW_COUNT - 1) as LaneIndex
  return row as LaneIndex
}

/** x liên tục (đơn vị cột) → column chiếm chỗ (làm tròn về ô gần nhất; -0 chuẩn hoá thành 0). */
export function getColumnFromWorldX(x: number): number {
  const rounded = x < GRID_COLUMN_COUNT
    ? Math.min(GRID_COLUMN_COUNT - 1, Math.round(x))
    : Math.round(x)

  return rounded === 0 ? 0 : rounded
}

export function worldToGridPosition(x: number, y: number): GridPosition {
  return {
    row: getLaneFromWorldY(y),
    column: getColumnFromWorldX(x),
  }
}

/** Tâm ô (row, column) theo đơn vị cột/hàng — renderer tự nhân cellSize. */
export function gridToWorldCenter(row: LaneIndex, column: number): WorldPoint {
  return { x: column + 0.5, y: row + 0.5 }
}

export function isInsideBattleGrid(position: GridPosition): boolean {
  return (
    position.row >= 0 &&
    position.row < GRID_ROW_COUNT &&
    position.column >= 0 &&
    position.column < GRID_COLUMN_COUNT
  )
}

export interface CellArea {
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
}

/**
 * Vùng ảnh hưởng quanh anchor theo laneRadius/columnRadius — CLAMP sẵn
 * vào biên grid nên AOE ở góc/tứ cạnh không tràn ra ngoài (acceptance
 * criteria: "AOE chọn đúng row/column ở cả bốn cạnh grid").
 *
 * Quy ước radius (spec mục 2): radius = 0 → chỉ hàng/cột của anchor;
 * radius = n → mở rộng n ô mỗi phía.
 */
export function getCellsInArea(
  anchor: GridPosition,
  laneRadius: number,
  columnRadius: number,
): CellArea {
  const safeLaneRadius = Math.max(0, Math.floor(laneRadius))
  const safeColumnRadius = Math.max(0, Math.floor(columnRadius))
  const anchorColumn = Math.max(0, Math.min(GRID_COLUMN_COUNT - 1, anchor.column))

  return {
    rowStart: Math.max(0, anchor.row - safeLaneRadius),
    rowEnd: Math.min(GRID_ROW_COUNT - 1, anchor.row + safeLaneRadius),
    colStart: Math.max(0, anchorColumn - safeColumnRadius),
    colEnd: Math.min(GRID_COLUMN_COUNT - 1, anchorColumn + safeColumnRadius),
  }
}

/** Entity tại (x, row) có đang nằm trong vùng CellArea không. */
export function isInCellArea(
  x: number,
  row: number,
  area: CellArea,
): boolean {
  const column = getColumnFromWorldX(x)
  return row >= area.rowStart && row <= area.rowEnd && column >= area.colStart && column <= area.colEnd
}
