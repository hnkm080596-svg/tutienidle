// Phase 3 — the drop target must be the slot the player sees.
//
// V8 fixed the *shapes*. This file asserts the property those shapes exist to
// deliver: a pointer landing on a drawn cell drops onto that cell, at any
// rendered size, and a pointer off the road drops onto nothing.
//
// None of this is testable through the DOM in jsdom: `clip-path` hit-testing is
// a browser behaviour jsdom does not implement. What IS testable — and is what
// would actually break — is the geometry the browser is handed. If the polygons
// tile the grid one-to-one with the projection's own inverse, then whatever
// polygon the browser picks is the cell the projection agrees on.
import { describe, expect, it } from 'vitest'
import {
  createFormationProjection,
  FORMATION_CANVAS_HEIGHT,
  FORMATION_CANVAS_WIDTH,
} from './FormationCanvasSpec'
import { createProjectionBridge } from './ProjectionBridge'
import { formationSlotBox, formationSlotStyle, slotCorners } from './formationSlotBoxes'
import { STANDING_SLOT_COUNT } from '@/core/battle/BattlefieldRegions'

const projection = createFormationProjection()
const bridge = createProjectionBridge(projection)

interface Point {
  x: number
  y: number
}

/** Ray casting. The polygons are convex quads, but this needs no such promise. */
function polygonContains(polygon: Point[], point: Point): boolean {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!
    const b = polygon[j]!

    const straddles = a.y > point.y !== b.y > point.y
    if (!straddles) continue

    const crossingX = a.x + ((point.y - a.y) / (b.y - a.y)) * (b.x - a.x)
    if (point.x < crossingX) inside = !inside
  }

  return inside
}

function centroid(polygon: Point[]): Point {
  return {
    x: polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length,
    y: polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length,
  }
}

function everySlot(): Array<{ row: number; column: number }> {
  const out: Array<{ row: number; column: number }> = []

  for (let row = 0; row < STANDING_SLOT_COUNT; row++) {
    for (let column = 0; column < STANDING_SLOT_COUNT; column++) {
      out.push({ row, column })
    }
  }

  return out
}

describe('formation slot hit-testing', () => {
  it("a point on a drawn cell inverts to that cell, not a neighbour", () => {
    for (const slot of everySlot()) {
      const point = centroid(slotCorners(bridge, slot.row, slot.column))
      const inverted = bridge.screenToGridUnclamped(point)

      expect(inverted).not.toBeNull()
      // `+ 0` normalises the signed zero Math.round(-0.0001) produces.
      expect(Math.round(inverted!.row) + 0).toBe(slot.row)
      expect(Math.round(inverted!.column) + 0).toBe(slot.column)
    }
  })

  it('the clip polygons tile the grid — no point belongs to two slots', () => {
    const polygons = everySlot().map((slot) => ({
      slot,
      points: slotCorners(bridge, slot.row, slot.column),
    }))

    for (const { slot, points } of polygons) {
      const probe = centroid(points)

      const owners = polygons.filter((candidate) => polygonContains(candidate.points, probe))

      expect(owners).toHaveLength(1)
      expect(owners[0]!.slot).toEqual(slot)
    }
  })

  it('a point above the horizon is on no slot at all — an invalid drop', () => {
    // The scenery band. The old uniform overlay accepted drops here, because it
    // had no idea where the road was.
    const aboveRoad = { x: FORMATION_CANVAS_WIDTH / 2, y: 1 }

    expect(bridge.containsScreenPoint(aboveRoad)).toBe(false)
    expect(bridge.screenToGridUnclamped(aboveRoad)).toBeNull()
  })

  it('every cell centre is on the playable surface', () => {
    for (const slot of everySlot()) {
      const point = centroid(slotCorners(bridge, slot.row, slot.column))

      expect(bridge.containsScreenPoint(point)).toBe(true)
    }
  })

  it('percentage placement survives the canvas being scaled to fit', () => {
    // The panel CSS-scales the canvas down (measured: 420x480 -> 362x414). If
    // the overlay were placed in pixels it would keep its original size and the
    // drop targets would drift — the defect V8 was, in a new form.
    const rendered = { width: 362, height: 414 }
    const factorX = rendered.width / FORMATION_CANVAS_WIDTH
    const factorY = rendered.height / FORMATION_CANVAS_HEIGHT

    for (const slot of everySlot()) {
      const box = formationSlotBox(bridge, slot.row, slot.column)
      const style = formationSlotStyle(bridge, slot.row, slot.column, {
        width: FORMATION_CANVAS_WIDTH,
        height: FORMATION_CANVAS_HEIGHT,
      })

      const resolve = (percent: string, against: number) =>
        (Number.parseFloat(percent) / 100) * against

      expect(resolve(style.left!, rendered.width)).toBeCloseTo(box.left * factorX, 2)
      expect(resolve(style.top!, rendered.height)).toBeCloseTo(box.top * factorY, 2)
      expect(resolve(style.width!, rendered.width)).toBeCloseTo(box.width * factorX, 2)
      expect(resolve(style.height!, rendered.height)).toBeCloseTo(box.height * factorY, 2)
    }
  })
})
