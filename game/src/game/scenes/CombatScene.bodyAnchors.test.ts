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

  it('a Rectangle fallback still gets anchors — it stands in a cell like anything else', () => {
    // The uniformity claim in Spec C §3.1, asserted rather than described.
    const scene = sceneWith('mortal_unknown_1', 5)
    const sprite = scene.sprites.get('mortal_unknown_1')

    sprite.kind = 'rect'

    expect(scene.bodyAnchorScreen('mortal_unknown_1', 'centre')).toEqual({ x: 300, y: 440 })
  })
})
