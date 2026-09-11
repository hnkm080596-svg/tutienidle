import { describe, expect, it } from 'vitest'
import {
  PERSON_HEIGHT_IN_CELLS,
  resolveEntityDisplaySize,
  type EntityScaleInput,
} from './combatEntityScale'

const UNTRIMMED = { x: 0, y: 0, w: 1, h: 1 }

/** The measured battlefield: near cell 94.49px, enemy row depth 0.70735. */
function enemyInput(overrides: Partial<EntityScaleInput> = {}): EntityScaleInput {
  return {
    nearCellWidth: 94.49,
    depthScale: 0.70735,
    classFactor: 1,
    extent: UNTRIMMED,
    sourceSize: { w: 1254, h: 1254 },
    ...overrides,
  }
}

describe('resolveEntityDisplaySize', () => {
  it('reproduces the existing enemy size exactly — this change is a no-op for real art', () => {
    // Spec C §3.2: PERSON_HEIGHT_IN_CELLS is 0.92 x 2, the product of the two
    // magic numbers already in the tree. Enemies must not move by a pixel, which
    // is what makes a visible change in step 3 attributable to the player alone.
    const size = resolveEntityDisplaySize(enemyInput())

    expect(size.personHeight).toBeCloseTo(122.98, 1)
    expect(size.boxHeight).toBeCloseTo(122.98, 1)
  })

  it('specifies the CHARACTER height and lets the box be whatever makes it true', () => {
    // The assertion whose absence let c0826723 ship.
    const trimmed = resolveEntityDisplaySize(
      enemyInput({ extent: { x: 0.28, y: 0.0943, w: 0.44, h: 0.7943 } }),
    )
    const untrimmed = resolveEntityDisplaySize(enemyInput())

    expect(trimmed.personHeight).toBeCloseTo(untrimmed.personHeight, 5)
    expect(trimmed.boxHeight).toBeGreaterThan(untrimmed.boxHeight)
    expect(trimmed.boxHeight).toBeCloseTo(untrimmed.personHeight / 0.7943, 4)
  })

  it('keeps the box at the art aspect ratio, so nothing is stretched', () => {
    const size = resolveEntityDisplaySize(enemyInput({ sourceSize: { w: 200, h: 350 } }))

    expect(size.boxWidth / size.boxHeight).toBeCloseTo(200 / 350, 5)
  })

  it('a boss is twice a person; an ordinary enemy and the player are equal', () => {
    const ordinary = resolveEntityDisplaySize(enemyInput())
    const boss = resolveEntityDisplaySize(enemyInput({ classFactor: 2 }))

    // The player differs only in its ART, never in its class.
    const player = resolveEntityDisplaySize(
      enemyInput({ extent: { x: 0.28, y: 0.0943, w: 0.44, h: 0.7943 }, sourceSize: { w: 200, h: 350 } }),
    )

    expect(player.personHeight).toBeCloseTo(ordinary.personHeight, 5)
    expect(boss.personHeight).toBeCloseTo(ordinary.personHeight * 2, 5)
  })

  it('scales with depth, so a far entity is smaller', () => {
    const near = resolveEntityDisplaySize(enemyInput({ depthScale: 1 }))
    const far = resolveEntityDisplaySize(enemyInput({ depthScale: 0.5 }))

    expect(far.personHeight).toBeCloseTo(near.personHeight / 2, 5)
  })

  it('person width comes from the cell, not from the art', () => {
    // Spec C §3.2: front/back anchors use this, and it must not depend on how
    // wide a particular drawing happens to be.
    const wide = resolveEntityDisplaySize(enemyInput({ sourceSize: { w: 2000, h: 350 } }))
    const narrow = resolveEntityDisplaySize(enemyInput({ sourceSize: { w: 100, h: 350 } }))

    expect(wide.personWidth).toBeCloseTo(narrow.personWidth, 5)
  })

  it('the calibration constant is the product the tree already had', () => {
    expect(PERSON_HEIGHT_IN_CELLS).toBeCloseTo(0.92 * 2, 5)
  })

  it('refuses an extent that would divide by zero', () => {
    expect(() => resolveEntityDisplaySize(enemyInput({ extent: { x: 0, y: 0, w: 1, h: 0 } }))).toThrow(
      /extent\.h/,
    )
  })
})
