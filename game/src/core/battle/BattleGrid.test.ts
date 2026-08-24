import { describe, expect, it } from 'vitest'
import {
  GRID_ROW_COUNT,
  GRID_COLUMN_COUNT,
  SPAWN_COLUMN,
  VISIBLE_MAX_COLUMN,
  getLaneFromWorldY,
  getColumnFromWorldX,
  worldToGridPosition,
  gridToWorldCenter,
  isInsideBattleGrid,
  getCellsInArea,
  isInCellArea,
} from './BattleGrid'

// Combat Grid Rework — acceptance criteria mục 12: "AOE chọn đúng
// row/column ở cả bốn cạnh grid", "lane suy ra thống nhất từ grid row".
describe('BattleGrid — chuyển đổi tọa độ', () => {
  it('getLaneFromWorldY: floor + clamp hai biên', () => {
    expect(getLaneFromWorldY(0)).toBe(0)
    expect(getLaneFromWorldY(2.9)).toBe(2)
    expect(getLaneFromWorldY(-5)).toBe(0)
    expect(getLaneFromWorldY(GRID_ROW_COUNT + 10)).toBe(GRID_ROW_COUNT - 1)
  })

  it('getColumnFromWorldX: làm tròn về ô gần nhất (column chiếm chỗ)', () => {
    expect(getColumnFromWorldX(3.4)).toBe(3)
    expect(getColumnFromWorldX(3.6)).toBe(4)
    expect(getColumnFromWorldX(-0.4)).toBe(0)
  })

  it('worldToGridPosition ghép row+column', () => {
    expect(worldToGridPosition(5.5, 7.2)).toEqual({ row: 7, column: 6 })
  })

  it('gridToWorldCenter trả tâm ô (+0.5)', () => {
    expect(gridToWorldCenter(3, 5)).toEqual({ x: 5.5, y: 3.5 })
  })

  it('isInsideBattleGrid: trong grid true, ngoài/spawn false', () => {
    expect(isInsideBattleGrid({ row: 0, column: 0 })).toBe(true)
    expect(isInsideBattleGrid({ row: GRID_ROW_COUNT - 1 as never, column: GRID_COLUMN_COUNT - 1 })).toBe(true)
    expect(isInsideBattleGrid({ row: 0, column: GRID_COLUMN_COUNT })).toBe(false)
    expect(isInsideBattleGrid({ row: GRID_ROW_COUNT as never, column: 0 })).toBe(false)
  })

  it('spawn nằm ngoài mép phải; visible max trong grid', () => {
    expect(SPAWN_COLUMN).toBe(GRID_COLUMN_COUNT)
    expect(VISIBLE_MAX_COLUMN).toBeLessThan(GRID_COLUMN_COUNT)
  })
})

describe('getCellsInArea — clamp ĐÚNG ở cả bốn cạnh (acceptance)', () => {
  const R = GRID_ROW_COUNT - 1
  const C = GRID_COLUMN_COUNT - 1

  it('giữa sân: row±r, col±r đầy đủ', () => {
    const area = getCellsInArea({ row: 5, column: 8 }, 2, 1)

    expect(area).toEqual({ rowStart: 3, rowEnd: 7, colStart: 7, colEnd: 9 })
  })

  it('cạnh TRÊN (row=0): không tràn âm', () => {
    const area = getCellsInArea({ row: 0, column: 8 }, 2, 1)

    expect(area.rowStart).toBe(0)
    expect(area.rowEnd).toBe(2)
  })

  it('cạnh DƯỚI (row=R): không vượt R', () => {
    const area = getCellsInArea({ row: R as never, column: 8 }, 2, 1)

    expect(area.rowStart).toBe(R - 2)
    expect(area.rowEnd).toBe(R)
  })

  it('cạnh TRÁI (col=0): không tràn âm', () => {
    const area = getCellsInArea({ row: 5, column: 0 }, 1, 2)

    expect(area.colStart).toBe(0)
    expect(area.colEnd).toBe(2)
  })

  it('cạnh PHẢI (col=C): không vượt C', () => {
    const area = getCellsInArea({ row: 5, column: C }, 1, 2)

    expect(area.colStart).toBe(C - 2)
    expect(area.colEnd).toBe(C)
  })

  it('góc trên-phải: cả hai trục clamp cùng lúc', () => {
    const area = getCellsInArea({ row: 0, column: C }, 3, 3)

    expect(area).toEqual({ rowStart: 0, rowEnd: 3, colStart: C - 3, colEnd: C })
  })

  it('radius = 0 → chỉ đúng ô anchor', () => {
    const area = getCellsInArea({ row: 4, column: 6 }, 0, 0)

    expect(area).toEqual({ rowStart: 4, rowEnd: 4, colStart: 6, colEnd: 6 })
  })

  it('isInCellArea: entity x liên tục quy về column rồi xét vùng', () => {
    const area = getCellsInArea({ row: 2, column: 8 }, 1, 1)

    // x=8.9 → col 9, row 2: trong vùng (col 7..9, row 1..3).
    expect(isInCellArea(8.9, 2, area)).toBe(true)
    // col 10 ngoài.
    expect(isInCellArea(10.2, 2, area)).toBe(false)
    // row 4 ngoài.
    expect(isInCellArea(8, 4, area)).toBe(false)
  })
})
