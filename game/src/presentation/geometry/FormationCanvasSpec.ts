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
