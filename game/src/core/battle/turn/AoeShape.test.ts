import { describe, expect, it } from 'vitest'
import { boundingBoxForShape, isCellInShape, type AoeShapeSpec } from './AoeShape'
import type { GridPosition } from '../BattleGrid'

const anchor: GridPosition = { row: 5, column: 8 }

function pos(row: number, column: number): GridPosition {
  return { row: row as GridPosition['row'], column }
}

describe('AoeShape', () => {
  it('single: chỉ đúng 1 ô anchor', () => {
    const spec: AoeShapeSpec = { shape: 'single', radius: 0 }
    expect(isCellInShape(anchor, spec, anchor)).toBe(true)
    expect(isCellInShape(anchor, spec, pos(5, 9))).toBe(false)
  })

  it('cross: cùng hàng hoặc cùng cột trong bán kính — KHÔNG phải khối vuông', () => {
    const spec: AoeShapeSpec = { shape: 'cross', radius: 1 }
    expect(isCellInShape(anchor, spec, pos(5, 9))).toBe(true)
    expect(isCellInShape(anchor, spec, pos(6, 8))).toBe(true)
    expect(isCellInShape(anchor, spec, pos(6, 9))).toBe(false)
    expect(isCellInShape(anchor, spec, pos(5, 10))).toBe(false)
  })

  it('square: khối vuông đầy đủ quanh anchor (bao gồm cả ô chéo)', () => {
    const spec: AoeShapeSpec = { shape: 'square', radius: 1 }
    expect(isCellInShape(anchor, spec, pos(6, 9))).toBe(true)
    expect(isCellInShape(anchor, spec, pos(7, 8))).toBe(false)
  })

  it('line: dải chữ nhật dài theo 1 trục (thay Pierce)', () => {
    const spec: AoeShapeSpec = { shape: 'line', radius: 3, axis: 'column' }
    expect(isCellInShape(anchor, spec, pos(5, 11))).toBe(true)
    expect(isCellInShape(anchor, spec, pos(6, 11))).toBe(false)
  })

  it('row/column: phủ hết chiều grid, clamp ở biên qua getCellsInArea', () => {
    const rowSpec: AoeShapeSpec = { shape: 'row', radius: 0 }
    expect(isCellInShape(anchor, rowSpec, pos(5, 0))).toBe(true)
    expect(isCellInShape(anchor, rowSpec, pos(5, 15))).toBe(true)
    expect(isCellInShape(anchor, rowSpec, pos(4, 0))).toBe(false)
  })

  it('boundingBoxForShape: square trả về CellArea clamp đúng biên grid', () => {
    const box = boundingBoxForShape({ row: 0, column: 0 } as GridPosition, {
      shape: 'square',
      radius: 2,
    })
    expect(box.rowStart).toBe(0)
    expect(box.colStart).toBe(0)
  })
})
