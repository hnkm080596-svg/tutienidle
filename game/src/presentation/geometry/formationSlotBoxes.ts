// Formation slot hit-zones, derived from the projection the canvas draws with.
//
// V8 / §3.6 of
// docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md.
//
// This is geometry, so it lives here rather than inside the panel component —
// §3.6's third surface is "pure functions under presentation/geometry/, which
// both sides import". Keeping it in the SFC would make it untestable without
// mounting Vue, and would put shared geometry in the static layer.
import type { ProjectionBridge } from './ProjectionBridge'

/** A slot's placement: bounding box in canvas pixels, plus its true shape. */
export interface SlotBox {
  left: number
  top: number
  width: number
  height: number
  /** CSS `clip-path` value, with points relative to the box's own origin. */
  clipPath: string
}

/**
 * The four corners of a grid cell, far edge first, clockwise — the same winding
 * `combat-grid-view.ts` uses when it strokes the grid, so the DOM hit-zone and
 * the drawn cell describe the same quadrilateral.
 */
export function slotCorners(bridge: ProjectionBridge, row: number, column: number) {
  return [
    bridge.gridToScreen({ row: row - 0.5, column: column - 0.5 }),
    bridge.gridToScreen({ row: row - 0.5, column: column + 0.5 }),
    bridge.gridToScreen({ row: row + 0.5, column: column + 0.5 }),
    bridge.gridToScreen({ row: row + 0.5, column: column - 0.5 }),
  ]
}

/**
 * Place one slot.
 *
 * The element is sized to the polygon's bounding box rather than to the whole
 * canvas, so a label inside it centres on the cell naturally. `clip-path` then
 * cuts it down to the real trapezoid — and because clip-path clips **pointer
 * events** as well as paint, that trapezoid becomes the hit area. This is what
 * lets the panel keep its existing drag-and-drop handlers untouched while the
 * geometry becomes correct.
 */
export function formationSlotBox(
  bridge: ProjectionBridge,
  row: number,
  column: number,
): SlotBox {
  const corners = slotCorners(bridge, row, column)

  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)

  const left = Math.min(...xs)
  const top = Math.min(...ys)

  const points = corners
    .map((corner) => `${(corner.x - left).toFixed(2)}px ${(corner.y - top).toFixed(2)}px`)
    .join(', ')

  return {
    left,
    top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
    clipPath: `polygon(${points})`,
  }
}

/**
 * The same box as CSS declarations, expressed in PERCENT of the canvas.
 *
 * Percent, not pixels, and for a specific reason: the panel is shorter than the
 * canvas is tall, so the canvas has to be CSS-scaled to fit. A pixel overlay
 * would keep its original size while the canvas shrank underneath it — the very
 * disagreement this work exists to remove. In percent, both scale together and
 * stay aligned at any size, with no ResizeObserver and no scale factor to keep
 * in sync.
 *
 * `clip-path` percentages resolve against the element's own border box, so the
 * polygon rides the element's own scaling too.
 */
export function formationSlotStyle(
  bridge: ProjectionBridge,
  row: number,
  column: number,
  canvas: { width: number; height: number },
): Record<string, string> {
  const box = formationSlotBox(bridge, row, column)

  const percentX = (value: number) => `${((value / canvas.width) * 100).toFixed(4)}%`
  const percentY = (value: number) => `${((value / canvas.height) * 100).toFixed(4)}%`

  const points = box.clipPath
    .replace(/^polygon\(|\)$/g, '')
    .split(', ')
    .map((pair) => {
      const [x, y] = pair.split(' ').map((n) => Number.parseFloat(n))

      return `${((x! / box.width) * 100).toFixed(4)}% ${((y! / box.height) * 100).toFixed(4)}%`
    })
    .join(', ')

  return {
    left: percentX(box.left),
    top: percentY(box.top),
    width: percentX(box.width),
    height: percentY(box.height),
    clipPath: `polygon(${points})`,
  }
}
