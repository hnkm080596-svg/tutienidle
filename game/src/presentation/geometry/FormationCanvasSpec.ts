// FormationCanvasSpec — the single owner of the Formation preview canvas size.
//
// V9 of the frontend static/dynamic boundary spec
// (docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md).
//
// The number used to be declared twice - TranPhapPanel.vue and
// TranPhapCombatPreviewScene.ts - kept in sync by a comment reading "must
// match". Two sources of truth for one number, and the alignment defect (V8)
// cannot be fixed while the DOM side and the canvas side can disagree about how
// big the canvas is.
//
// The values below are the CURRENT ones, unchanged. Phase 0 moves the
// declaration; it does not resize anything. If the panel is ever given discrete
// size presets, they belong here, beside these constants - and choosing them is
// a layout decision for the alignment work, not a side effect of centralising a
// constant.
import { STANDING_SLOT_COUNT } from '@/core/battle/BattlefieldRegions'
import {
  computePerspectiveGeometry,
  createBattleGridProjection,
  type BattleGridProjection,
  type PerspectiveGeometry,
  type ProjectionViewport,
} from './BattleGridProjection'

/** Formation preview canvas width, in CSS pixels. */
export const FORMATION_CANVAS_WIDTH = 420

/** Formation preview canvas height, in CSS pixels. */
export const FORMATION_CANVAS_HEIGHT = 480

/**
 * Derived, not imposed: whatever the two constants above say. Exported so a
 * container can reserve the right shape without restating either number.
 * Portrait today (0.875), because the preview shows a battlefield receding away
 * from the viewer rather than a wide landscape.
 */
export const FORMATION_CANVAS_ASPECT_RATIO = FORMATION_CANVAS_WIDTH / FORMATION_CANVAS_HEIGHT

/**
 * Minimum road height for the preview panel. Smaller than combat's, because
 * the panel is short and the road would otherwise be squeezed to nothing by
 * the scenery band. Moved here from the scene (V7/§3.6.2): the shell needs it
 * to build the same projection the canvas draws with, and a constant stranded
 * in `src/game/` would force the static layer to import from the dynamic one.
 */
export const FORMATION_MIN_ROAD_HEIGHT = 140

/** The viewport the preview canvas projects into. No DOM chrome, so no insets. */
export const FORMATION_VIEWPORT: ProjectionViewport = {
  width: FORMATION_CANVAS_WIDTH,
  height: FORMATION_CANVAS_HEIGHT,
  topInset: 0,
  bottomInset: 0,
}

/**
 * Build the Formation preview's projection.
 *
 * Both layers call this — the scene to draw with, the shell to hit-test
 * against — and that is exactly what §3.6.2 requires: two instances are safe
 * only while they derive from the *same declared parameters*. Before this
 * existed, the five parameters were restated at each construction site, and one
 * of them lived in the Phaser layer where the shell could not legally read it.
 *
 * Each caller gets its own instance. That is deliberate: the projection is
 * mutable through `resize()`, so a shared singleton would let one caller move
 * the other's geometry. Nothing resizes this one today — the panel canvas is a
 * fixed size — which is precisely why Formation is allowed the two-instance
 * pattern while Combat, whose viewport is dynamic, is not.
 */
export function createFormationProjection(): BattleGridProjection {
  return createBattleGridProjection(
    'perspective',
    FORMATION_VIEWPORT,
    STANDING_SLOT_COUNT,
    STANDING_SLOT_COUNT,
    FORMATION_MIN_ROAD_HEIGHT,
  )
}

/** Sky/ground split for the preview backdrop, from the same parameters. */
export function formationPerspectiveGeometry(): PerspectiveGeometry {
  return computePerspectiveGeometry(FORMATION_VIEWPORT, FORMATION_MIN_ROAD_HEIGHT)
}
