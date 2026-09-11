// V8 — the DOM hit-zone and the drawn cell must describe the same shape.
//
// This is the assertion the Formation panel had no way to make before: its DOM
// grid was a uniform 56x56 CSS grid, and the canvas beneath drew perspective
// trapezoids. Nothing compared the two, so nothing failed.
import { describe, expect, it } from 'vitest'
import {
  createFormationProjection,
  FORMATION_CANVAS_HEIGHT,
  FORMATION_CANVAS_WIDTH,
} from './FormationCanvasSpec'
import { createProjectionBridge } from './ProjectionBridge'
import { formationSlotBox, slotCorners } from './formationSlotBoxes'
import { STANDING_SLOT_COUNT } from '@/core/battle/BattlefieldRegions'

const bridge = createProjectionBridge(createFormationProjection())

/** Every (row, column) of the standing-slot grid. */
function everySlot(): Array<{ row: number; column: number }> {
  const out: Array<{ row: number; column: number }> = []

  for (let row = 0; row < STANDING_SLOT_COUNT; row++) {
    for (let column = 0; column < STANDING_SLOT_COUNT; column++) {
      out.push({ row, column })
    }
  }

  return out
}

describe('formation slot boxes', () => {
  it('a slot box bounds exactly the projected cell corners', () => {
    for (const { row, column } of everySlot()) {
      const corners = slotCorners(bridge, row, column)
      const box = formationSlotBox(bridge, row, column)

      expect(box.left).toBeCloseTo(Math.min(...corners.map((c) => c.x)), 9)
      expect(box.top).toBeCloseTo(Math.min(...corners.map((c) => c.y)), 9)
      expect(box.left + box.width).toBeCloseTo(Math.max(...corners.map((c) => c.x)), 9)
      expect(box.top + box.height).toBeCloseTo(Math.max(...corners.map((c) => c.y)), 9)
    }
  })

  it('the clip polygon reproduces the projected corners, box-relative', () => {
    const { row, column } = { row: 1, column: 1 }

    const corners = slotCorners(bridge, row, column)
    const box = formationSlotBox(bridge, row, column)

    const parsed = box.clipPath
      .replace(/^polygon\(|\)$/g, '')
      .split(', ')
      .map((pair) => pair.split(' ').map((n) => Number.parseFloat(n)))

    expect(parsed).toHaveLength(4)

    parsed.forEach(([x, y], index) => {
      expect(box.left + x!).toBeCloseTo(corners[index]!.x, 1)
      expect(box.top + y!).toBeCloseTo(corners[index]!.y, 1)
    })
  })

  it('rows are NOT uniform — the geometry is perspective, not a CSS grid', () => {
    // The regression this guards: any return to an evenly-spaced grid, which is
    // what the panel had. A near row must be taller and wider than a far one.
    const far = formationSlotBox(bridge, 0, 1)
    const near = formationSlotBox(bridge, STANDING_SLOT_COUNT - 1, 1)

    expect(near.height).toBeGreaterThan(far.height * 1.2)
    expect(near.width).toBeGreaterThan(far.width * 1.2)
  })

  it('every slot lands inside the canvas it is drawn on', () => {
    // The old overlay was 176x176 over a 420x480 canvas; these bounds are what
    // that mismatch would violate.
    for (const { row, column } of everySlot()) {
      const box = formationSlotBox(bridge, row, column)

      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.left + box.width).toBeLessThanOrEqual(FORMATION_CANVAS_WIDTH)
      expect(box.top + box.height).toBeLessThanOrEqual(FORMATION_CANVAS_HEIGHT)
    }
  })

  it('slots do not overlap horizontally within a row', () => {
    for (let row = 0; row < STANDING_SLOT_COUNT; row++) {
      const boxes = Array.from({ length: STANDING_SLOT_COUNT }, (_, column) =>
        formationSlotBox(bridge, row, column),
      )

      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i]!.left).toBeGreaterThanOrEqual(boxes[i - 1]!.left)
      }
    }
  })
})
