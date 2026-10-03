// Turn-Based Combat Foundation (spec Phan 4) - moi shape neo tai O MUC
// TIEU (anchor = target cell, KHONG phai o nguoi thuc hien). boundingBox
// dung cho VFX (khoi chu nhat clamp bien qua getCellsInArea san co);
// isCellInShape moi la luat targeting THAT - cross la hinh chu thap, mot
// khoi chu nhat clamp se SAI (se lan ca o cheo).
import { getCellsInArea, type CellArea, type GridPosition } from '../BattleGrid'

export type AoeShapeId = 'single' | 'cross' | 'square' | 'line' | 'row' | 'column'

export interface AoeShapeSpec {
  shape: AoeShapeId
  radius: number
  /** Bat buoc cho 'line': truc nao la chieu dai (thay Pierce cu). */
  axis?: 'row' | 'column'
}

// Du lon de phu het 10x16 khi dung cho 'row'/'column' - getCellsInArea tu
// clamp ve bien grid that, khong can biet GRID_ROW_COUNT/GRID_COLUMN_COUNT
// o day.
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
