// ProjectionBridge — the read-only view of a battle grid projection that the
// STATIC layer is allowed to hold.
//
// Spec §4.4 of
// docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md.
//
// Why this exists at all, given BattleGridProjection is already a plain object
// the DOM could import directly: `BattleGridProjection` has `resize()`. Handing
// the raw projection to a Vue component hands it the power to resize the very
// geometry the canvas is drawing with — and a projection resized by the DOM
// while the canvas believes otherwise is precisely the "two layers disagree
// about geometry" failure that §3.5 exists to forbid. The bridge is that same
// mathematics with the mutating half removed.
//
// It adds no maths. Both directions already existed and were already correct;
// only the inverse had no consumer.
import type { BattleGridProjection } from './BattleGridProjection'

/** A cell address. Fractional values are meaningful: -0.5 is a cell's far edge. */
export interface GridPosition {
  row: number
  column: number
}

/** A point in CANVAS pixel space. See the note on coordinate space below. */
export interface ScreenPoint {
  x: number
  y: number
}

/** A projected point: the FOOT POINT at the cell centre, plus its depth scale. */
export interface ProjectedPoint extends ScreenPoint {
  /** 1 at the near row, smaller with depth. */
  scale: number
}

/**
 * Read-only projection access for the static layer.
 *
 * **Coordinate space.** Every `ScreenPoint` here is in *canvas* pixels — the
 * same space the projection itself uses, which is the canvas's declared
 * `width`/`height`. A DOM pointer event is in *CSS* pixels relative to its
 * target. Those two spaces coincide only while the canvas is rendered at its
 * declared size. Converting between them is the caller's job and belongs to
 * whoever owns the layout; this bridge deliberately does not guess at it,
 * because guessing is the defect (§3.5). See V8 in the spec — the Formation
 * panel's layout is presently wrong in exactly this way, and its own plan owns
 * the conversion.
 */
export interface ProjectionBridge {
  readonly rows: number
  readonly columns: number

  /** Cell → canvas point. Accepts fractional row/column for cell corners. */
  gridToScreen(grid: GridPosition): ProjectedPoint

  /** Canvas point → cell. `null` when the point is off the playable surface. */
  screenToGridUnclamped(screen: ScreenPoint): GridPosition | null

  /** Is this canvas point on the playable surface at all? */
  containsScreenPoint(screen: ScreenPoint): boolean
}

/**
 * Wraps a projection. Holds no geometry of its own: every call delegates, so a
 * projection that has been resized is immediately reflected here. A bridge that
 * cached anything would be a second copy of the geometry, free to disagree with
 * the canvas — the thing this whole mechanism is meant to prevent.
 */
export function createProjectionBridge(projection: BattleGridProjection): ProjectionBridge {
  return {
    get rows() {
      return projection.rows
    },

    get columns() {
      return projection.columns
    },

    gridToScreen({ row, column }) {
      return projection.gridToScreen(row, column)
    },

    screenToGridUnclamped({ x, y }) {
      return projection.screenToGridUnclamped(x, y)
    },

    containsScreenPoint({ x, y }) {
      return projection.containsScreenPoint(x, y)
    },
  }
}
