// Combat Grid Rework (2026-08-24) - nguon DUY NHAT cho he toa do chien
// truong dang luoi vuong 10 hang x 16 cot.
//
// Nguyen tac:
// - `row` (LaneIndex) la gia tri ROI RAC - chinh la lane.
// - Entity giu `x` LIEN TUC do bang DON VI COT (column units): quai di
//   chuyen muot, column chiem cho = lam tron x tai thoi diem query/impact.
// - Renderer tu scale dong deu de o luon VUONG (khong keo chu nhat);
//   viewport lech ti le xu ly bang letterbox/padding, khong dung logic.
// - Core KHONG biet pixel - moi khoang cach combat (range/AOE) tinh bang
//   cot/hang qua BattleGrid.
import type { CombatEntity } from '../combat/CombatEntity'

export const GRID_ROW_COUNT = 10
export const GRID_COLUMN_COUNT = 16

// Quai spawn NGOAI mep phai grid (offscreen) roi di vao.
export const SPAWN_COLUMN = GRID_COLUMN_COUNT

// Cot xa nhat con tinh la "trong tam nhin" (mirror semantics cu cua
// SCREEN_VISIBLE_MAX_X: spawn phai nam ngoai moc nay).
export const VISIBLE_MAX_COLUMN = GRID_COLUMN_COUNT - 0.5

/**
 * Hang roi rac 0..GRID_ROW_COUNT-1 - trung khai niem lane cu nhung mo
 * rong tu 5 len 10 hang (grid vuong 16x10).
 */
export type LaneIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface GridPosition {
  row: LaneIndex
  column: number
}

/**
 * Khoang cach Chebyshev giua 2 o grid (range 1 phu ca 8 o ke, gom duong
 * cheo). MOI logic targeting do khoang cach o dung helper nay, khong tu
 * tinh khoang cach rieng (plan sec4.1).
 */
export function getChebyshevDistance(from: GridPosition, to: GridPosition): number {
  return Math.max(Math.abs(to.row - from.row), Math.abs(to.column - from.column))
}

/**
 * Chuan hoa vi tri entity ve o grid - column LAM TRON qua dung
 * getColumnFromWorldX() (x la world-unit lien tuc), row giu nguyen vi da
 * roi rac. Player targeting/enemy gate deu di qua day de tranh tu lam tron
 * lech nhau giua cac noi goi.
 */
export function entityGridPosition(entity: Pick<CombatEntity, 'x' | 'row'>): GridPosition {
  return {
    row: entity.row,
    column: getColumnFromWorldX(entity.x),
  }
}

/** Tam o theo don vi cot/hang (dung cho renderer neo VFX/tween). */
export interface WorldPoint {
  x: number
  y: number
}

export function isValidLane(value: number): value is LaneIndex {
  return Number.isInteger(value) && value >= 0 && value < GRID_ROW_COUNT
}

/** y lien tuc (don vi hang) -> row roi rac, clamp trong grid. */
export function getLaneFromWorldY(y: number): LaneIndex {
  const row = Math.floor(y)
  if (row < 0) return 0
  if (row >= GRID_ROW_COUNT) return (GRID_ROW_COUNT - 1) as LaneIndex
  return row as LaneIndex
}

/** x lien tuc (don vi cot) -> column chiem cho (lam tron ve o gan nhat; -0 chuan hoa thanh 0). */
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

/** Tam o (row, column) theo don vi cot/hang - renderer tu nhan cellSize. */
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
 * Vung anh huong quanh anchor theo laneRadius/columnRadius - CLAMP san
 * vao bien grid nen AOE o goc/tu canh khong tran ra ngoai (acceptance
 * criteria: "AOE chon dung row/column o ca bon canh grid").
 *
 * Quy uoc radius (spec muc 2): radius = 0 -> chi hang/cot cua anchor;
 * radius = n -> mo rong n o moi phia.
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

/** Entity tai (x, row) co dang nam trong vung CellArea khong. */
export function isInCellArea(
  x: number,
  row: number,
  area: CellArea,
): boolean {
  const column = getColumnFromWorldX(x)
  return row >= area.rowStart && row <= area.rowEnd && column >= area.colStart && column <= area.colEnd
}
