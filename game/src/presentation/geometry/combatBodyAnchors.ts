// combatBodyAnchors — the five points on a combat entity that effects attach to.
//
// Spec C §3.1/§4.2
// (docs/superpowers/specs/2026-09-12-combat-anchor-scale-geometry-design.md).
//
// THEY COME FROM THE BATTLEFIELD CELL, NOT FROM THE ART. Nothing here reads a
// texture, a frame, a trim offset or a sprite transform, and that is the whole
// design rather than a simplification of it:
//
//   - it is UNIFORM: an enemy outside the Mortal art batch renders as a
//     Rectangle and has no art to measure, and used to need a separate hardcoded
//     path for exactly that reason;
//   - it is STABLE: an art-derived anchor moves as the character breathes, so an
//     effect pinned to the head would jitter with the idle bob;
//   - it CANNOT GO STALE: there is no datum describing the art, so there is no
//     datum that can describe the wrong art — which is the defect that motivated
//     this spec.
//
// What it gives up, knowingly: the anchors describe a notional body standing in
// a cell, not the character drawn in it. An effect at `front` leaves a body edge,
// not the actual hand. "Lech khong quan trong" — the product owner's call.
export type BodyAnchorId = 'top' | 'bottom' | 'centre' | 'front' | 'back'

/** Which way the entity faces. The player faces right; enemies face left. */
export type Facing = 'right' | 'left'

export interface BodyBox {
  /** Projected foot point at the centre of the entity's cell. */
  footX: number
  footY: number

  /** Character size, from combatEntityScale — NOT the sprite's box. */
  personWidth: number
  personHeight: number

  facing: Facing
}

export interface AnchorPoint {
  x: number
  y: number
}

export function bodyAnchor(id: BodyAnchorId, body: BodyBox): AnchorPoint {
  const midY = body.footY - body.personHeight / 2
  const halfW = body.personWidth / 2

  // Screen y grows downward, so "up" is subtraction.
  switch (id) {
    case 'bottom':
      return { x: body.footX, y: body.footY }
    case 'top':
      return { x: body.footX, y: body.footY - body.personHeight }
    case 'centre':
      return { x: body.footX, y: midY }
    case 'front':
      return { x: body.facing === 'right' ? body.footX + halfW : body.footX - halfW, y: midY }
    case 'back':
      return { x: body.facing === 'right' ? body.footX - halfW : body.footX + halfW, y: midY }
  }
}
