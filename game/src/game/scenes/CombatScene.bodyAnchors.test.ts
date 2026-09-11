// @vitest-environment jsdom
//
// Spec C §4.2 — the scene turns an entity id into a body box and asks
// combatBodyAnchors for a point. No Phaser runtime needed: the sprite's
// personWidth/personHeight are set by the grid view (Task 3) and read here.
import { describe, expect, it } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import { PLAYER_ID } from './combat/combatConstants'

function sceneWith(id: string, row: number) {
  const scene = createTestScene('bare')

  scene.sprites = new Map()
  scene.renderMode = 'perspective' // isPerspective getter reads from renderMode.
  scene.projection = {
    rows: 10,
    columns: 16,
    gridToScreen: () => ({ x: 300, y: 500, scale: 1 }),
    cellSizeAt: () => ({ width: 94.49, height: 41.4 }),
    footprintPolygon: () => [],
  }

  scene.sprites.set(id, {
    kind: 'sprite',
    rect: { x: 300, y: 500 },
    row,
    footY: 500,
    columnFloat: 8,
    personWidth: 40,
    personHeight: 120,
    boost: { value: 1 },
  })

  return scene
}

describe('CombatScene.bodyAnchorScreen()', () => {
  it('bottom is the foot point; top is a person height above it', () => {
    const scene = sceneWith(PLAYER_ID, 4)

    expect(scene.bodyAnchorScreen(PLAYER_ID, 'bottom')).toEqual({ x: 300, y: 500 })
    expect(scene.bodyAnchorScreen(PLAYER_ID, 'top')).toEqual({ x: 300, y: 380 })
  })

  it('the player faces right and an enemy faces left', () => {
    const player = sceneWith(PLAYER_ID, 4)
    const enemy = sceneWith('mortal_wild_boar_1', 6)

    expect(player.bodyAnchorScreen(PLAYER_ID, 'front')!.x).toBe(320)
    expect(enemy.bodyAnchorScreen('mortal_wild_boar_1', 'front')!.x).toBe(280)
  })

  it('an entity with no sprite yields undefined rather than a guess', () => {
    const scene = sceneWith(PLAYER_ID, 4)

    expect(scene.bodyAnchorScreen('nobody', 'centre')).toBeUndefined()
  })

  it('a Rectangle fallback gets REAL anchors from entityDisplaySize, not the pre-fix half-height default', () => {
    // Finding 1, final whole-branch review: the old version of this test
    // hand-set personWidth: 40, personHeight: 120 on the fixture and only
    // THEN flipped `kind` to 'rect' — a state production never produces
    // (personWidth/personHeight are written by the sizing methods, which used
    // to skip the Rectangle branch entirely). It asserted nothing about the
    // fix. This version starts as a real Rectangle with NO personWidth/
    // personHeight and drives the actual production sizing method
    // (applyEntityDepthScale, in combat-grid-view.ts) before reading anchors,
    // so it fails if that method ever again stops writing them for a
    // Rectangle.
    const scene = createTestScene('bare')

    scene.characterWidth = 40
    scene.characterHeight = 50
    scene.projection = undefined
    scene.playerSourceSize = { w: 1, h: 1 } // any sourceSize works; only affects boxWidth, which is discarded here.
    scene.sprites = new Map()

    const rect: { width: number; height: number; x: number; updateDisplayOrigin(): unknown } = {
      width: 0,
      height: 0,
      x: 300,
      updateDisplayOrigin() {
        return this
      },
    }

    const sprite: {
      kind: string
      rect: typeof rect
      row: number
      footY: number
      columnFloat: number
      sizeMultiplier: number
      boost: { value: number }
      personWidth?: number
      personHeight?: number
    } = {
      kind: 'rect',
      rect,
      row: 5,
      footY: 500,
      columnFloat: 8,
      sizeMultiplier: 1,
      boost: { value: 1 },
    }

    scene.sprites.set('mortal_unknown_1', sprite)

    scene.applyEntityDepthScale(sprite, 1)

    // classFactor = sizeMultiplier / 2 = 0.5; no projection so nearCellWidth
    // falls back to characterHeight (50); personHeight = 50 * 1 * 0.5 * 1.84.
    expect(sprite.personHeight).toBeCloseTo(46, 5)
    expect(sprite.personWidth).toBeCloseTo(50 * 0.5 * 0.42, 5)

    expect(scene.bodyAnchorScreen('mortal_unknown_1', 'bottom')).toEqual({ x: 300, y: 500 })
    expect(scene.bodyAnchorScreen('mortal_unknown_1', 'top')).toEqual({
      x: 300,
      y: 500 - (sprite.personHeight ?? 0),
    })
  })
})
