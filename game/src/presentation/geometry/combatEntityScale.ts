// combatEntityScale — how big a combat entity is drawn.
//
// Spec C §3.2/§4.3
// (docs/superpowers/specs/2026-09-12-combat-anchor-scale-geometry-design.md).
//
// A pure module: no Phaser, no GameObject, no scene. It lives beside
// BattleGridProjection for the same reason that one does — it is arithmetic, and
// arithmetic should be testable without a canvas (Spec A §3.6).
//
// THE CLAIM THIS FILE MAKES, and the reason it exists: what gets specified is
// the size of the CHARACTER, and the sprite's box is whatever it has to be to
// make that true. Sizing the box instead is how the player came to render 3.44x
// too wide while every test stayed green (c0826723).
import type { ArtExtent } from '@/presentation/art/CombatEntityPresentation'

/**
 * An adult person stands this many near-row cell widths tall.
 *
 * The near cell's WIDTH is the ruler because the cell's HEIGHT is
 * perspective-compressed and is not a ruler for anything upright — a reason the
 * tree already carried in a comment and never turned into a number.
 *
 * 1.84 is not a new guess: it is 0.92 (the old `characterHeight` factor) times 2
 * (the old `ENEMY_DISPLAY_SCALE_MULTIPLIER`), so existing enemy art renders at
 * bit-identical size. Measured 2026-09-12 at 1600x900: near cell 94.49px, enemy
 * at depth 0.70735 rendered 122.98px, and 122.98 / (94.49 * 0.70735) = 1.840.
 */
export const PERSON_HEIGHT_IN_CELLS = 1.84

/**
 * And this many across. Used ONLY by the front/back body anchors.
 *
 * This one has no anchor in the existing code — nothing ever expressed a
 * person's width for a Sprite (`CHARACTER_WIDTH_RATIO` is a health-bar
 * measurement). 0.42 is a judgement from looking at the enemy art, and Spec C
 * §8 records that it is the weakest number in the design.
 */
export const PERSON_WIDTH_IN_CELLS = 0.42

export interface EntityScaleInput {
  /** Width of a cell on the NEAR row. The ruler; see PERSON_HEIGHT_IN_CELLS. */
  nearCellWidth: number

  /** Perspective factor for the entity's own row (near = 1). */
  depthScale: number

  /** 1 for a person, 2 for a boss. The only thing class changes. */
  classFactor: number

  /** How much of its authored box the art fills. */
  extent: ArtExtent

  /** The authored box, for aspect ratio only. */
  sourceSize: { w: number; h: number }
}

export interface EntityDisplaySize {
  /** What to pass to setDisplaySize — the whole authored box. */
  boxWidth: number
  boxHeight: number

  /** The character inside it. What the anchors and the design talk about. */
  personWidth: number
  personHeight: number
}

export function resolveEntityDisplaySize(input: EntityScaleInput): EntityDisplaySize {
  if (input.extent.h <= 0) {
    throw new Error('resolveEntityDisplaySize: extent.h must be greater than zero')
  }

  const unit = input.nearCellWidth * input.depthScale * input.classFactor

  const personHeight = unit * PERSON_HEIGHT_IN_CELLS
  const personWidth = unit * PERSON_WIDTH_IN_CELLS

  // The division is the whole design: the box grows to accommodate the art's
  // empty margin so that the CHARACTER lands at personHeight.
  const boxHeight = personHeight / input.extent.h
  const boxWidth = boxHeight * (input.sourceSize.w / input.sourceSize.h)

  return { boxWidth, boxHeight, personWidth, personHeight }
}
