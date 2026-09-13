// ProjectionBridge — spec §4.4. Pure maths, no Phaser, no DOM.
//
// The bridge adds no geometry, so what is worth testing is not the projection's
// arithmetic (BattleGridProjection.test.ts already owns that) but the three
// properties the bridge itself promises: the round trip survives the wrapper,
// it is stateless, and it exposes no way to mutate the projection.
import { describe, expect, it } from 'vitest'
import { createBattleGridProjection } from './BattleGridProjection'
import { createProjectionBridge } from './ProjectionBridge'
import { FORMATION_CANVAS_HEIGHT, FORMATION_CANVAS_WIDTH } from './FormationCanvasSpec'

const COMBAT_VIEWPORT = { width: 1280, height: 720, topInset: 80, bottomInset: 70 }

const FORMATION_VIEWPORT = {
  width: FORMATION_CANVAS_WIDTH,
  height: FORMATION_CANVAS_HEIGHT,
  topInset: 0,
  bottomInset: 0,
}

describe('ProjectionBridge', () => {
  describe('round trip survives the wrapper', () => {
    // The inverse is closed-form, not iterative, so this should land on the
    // original value to floating-point precision rather than merely near it.
    for (const mode of ['perspective', 'flat'] as const) {
      it(`screenToGridUnclamped(gridToScreen(cell)) returns the cell — ${mode}`, () => {
        const bridge = createProjectionBridge(
          createBattleGridProjection(mode, COMBAT_VIEWPORT),
        )

        for (const row of [0, 1, 4.5, 7, 9]) {
          for (const column of [0, 3, 7.5, 15]) {
            const screen = bridge.gridToScreen({ row, column })
            const back = bridge.screenToGridUnclamped(screen)

            expect(back).not.toBeNull()
            expect(back!.row).toBeCloseTo(row, 9)
            expect(back!.column).toBeCloseTo(column, 9)
          }
        }
      })
    }

    it('holds at the Formation panel size and cell count too', () => {
      const bridge = createProjectionBridge(
        createBattleGridProjection('perspective', FORMATION_VIEWPORT, 3, 3),
      )

      expect(bridge.rows).toBe(3)
      expect(bridge.columns).toBe(3)

      for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
          const back = bridge.screenToGridUnclamped(bridge.gridToScreen({ row, column }))

          expect(back!.row).toBeCloseTo(row, 9)
          expect(back!.column).toBeCloseTo(column, 9)
        }
      }
    })
  })

  it('reports a point above the horizon as off the surface', () => {
    const projection = createBattleGridProjection('perspective', COMBAT_VIEWPORT)
    const bridge = createProjectionBridge(projection)

    const sky = { x: COMBAT_VIEWPORT.width / 2, y: 0 }

    expect(bridge.containsScreenPoint(sky)).toBe(false)
    expect(bridge.screenToGridUnclamped(sky)).toBeNull()

    // ...and a point on the near row is on it.
    const near = bridge.gridToScreen({ row: 9, column: 8 })

    expect(bridge.containsScreenPoint(near)).toBe(true)
  })

  it('is stateless: a resize of the projection shows through immediately', () => {
    // A bridge that cached geometry would keep answering with the old viewport,
    // which is exactly the "two layers disagree" failure it exists to prevent.
    const projection = createBattleGridProjection('perspective', COMBAT_VIEWPORT)
    const bridge = createProjectionBridge(projection)

    const before = bridge.gridToScreen({ row: 5, column: 8 })

    projection.resize({ ...COMBAT_VIEWPORT, width: 640, height: 480 })

    const after = bridge.gridToScreen({ row: 5, column: 8 })

    expect(after).not.toEqual(before)
    expect(after).toEqual(projection.gridToScreen(5, 8))
  })

  it('exposes no way for the static layer to mutate the projection', () => {
    // The point of the bridge (spec §4.4): resize() is the projection's only
    // mutator, and the DOM must not reach it. If this ever passes with
    // 'resize' present, the bridge has stopped being read-only.
    const bridge = createProjectionBridge(
      createBattleGridProjection('perspective', COMBAT_VIEWPORT),
    )

    expect(Object.keys(bridge).sort()).toEqual([
      'columns',
      'containsScreenPoint',
      'gridToScreen',
      'rows',
      'screenToGridUnclamped',
    ])
  })
})
