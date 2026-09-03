// Turn-Based Combat Foundation (spec Phần 4) — mọi shape neo tại Ô MỤC
// TIÊU (anchor = target cell, KHÔNG phải ô người thực hiện). boundingBox
// dùng cho VFX (khối chữ nhật clamp biên qua getCellsInArea sẵn có);
// isCellInShape mới là luật targeting THẬT — cross là hình chữ thập, một
// khối chữ nhật clamp sẽ SAI (sẽ lẫn cả ô chéo).
import { getCellsInArea, type CellArea, type GridPosition } from '../BattleGrid'

export type AoeShapeId = 'single' | 'cross' | 'square' | 'line' | 'row' | 'column'

export interface AoeShapeSpec {
  shape: AoeShapeId
  radius: number
  /** Bắt buộc cho 'line': trục nào là chiều dài (thay Pierce cũ). */
  axis?: 'row' | 'column'
}

// Đủ lớn để phủ hết 10x16 khi dùng cho 'row'/'column' — getCellsInArea tự
// clamp về biên grid thật, không cần biết GRID_ROW_COUNT/GRID_COLUMN_COUNT
// ở đây.
const FULL_GRID_RADIUS = 999

export function boundingBoxForShape(anchor: GridPosition, spec: AoeShapeSpec): CellArea {
  switch (spec.shape) {
    case 'single':
      return getCellsInArea(anchor, 0, 0)
    case 'cross':
    case 'square':
      return getCellsInArea(anchor, spec.radius, spec.radius)
    case 'line':
      return spec.axis === 'row'
        ? getCellsInArea(anchor, spec.radius, 0)
        : getCellsInArea(anchor, 0, spec.radius)
    case 'row':
      return getCellsInArea(anchor, 0, FULL_GRID_RADIUS)
    case 'column':
      return getCellsInArea(anchor, FULL_GRID_RADIUS, 0)
  }
}

function isWithinBox(cell: GridPosition, box: CellArea): boolean {
  return (
    cell.row >= box.rowStart &&
    cell.row <= box.rowEnd &&
    cell.column >= box.colStart &&
    cell.column <= box.colEnd
  )
}

export function isCellInShape(anchor: GridPosition, spec: AoeShapeSpec, cell: GridPosition): boolean {
  switch (spec.shape) {
    case 'single':
      return cell.row === anchor.row && cell.column === anchor.column
    case 'cross':
      return (
        (cell.column === anchor.column && Math.abs(cell.row - anchor.row) <= spec.radius) ||
        (cell.row === anchor.row && Math.abs(cell.column - anchor.column) <= spec.radius)
      )
    case 'row':
      return cell.row === anchor.row
    case 'column':
      return cell.column === anchor.column
    case 'square':
    case 'line':
      return isWithinBox(cell, boundingBoxForShape(anchor, spec))
  }
}
