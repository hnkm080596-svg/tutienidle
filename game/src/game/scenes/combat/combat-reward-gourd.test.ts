// @vitest-environment jsdom
//
// Spec C §3.1 — the reward gourd's source point comes from the same
// bodyAnchorScreen() rule as everything else, not a player-only anchor plus
// a hardcoded enemy fallback. Harness pattern matches
// CombatScene.bodyAnchors.test.ts.
import { describe, expect, it } from 'vitest'
import { createTestScene } from './combatTestHarness'
import { PLAYER_ID } from './combatConstants'
import { CombatRewardGourd } from './combat-reward-gourd'
import type { CombatScene } from '../CombatScene'

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

describe('CombatRewardGourd — reward source (Spec C §3.1)', () => {
  it('player and enemy launch from the SAME rule, not two code paths', () => {
    // The regression this pins: the gourd used the player's hand-authored
    // `chest` for the player and a hardcoded "~40% of height" for everyone else,
    // so a companion would have needed a third rule.
    const scene = sceneWith(PLAYER_ID, 4)

    scene.sprites.set('mortal_wild_boar_1', {
      kind: 'sprite',
      rect: { x: 300, y: 500 },
      row: 4,
      footY: 500,
      columnFloat: 8,
      personWidth: 40,
      personHeight: 120,
      boost: { value: 1 },
    })

    const gourd = new CombatRewardGourd(scene as unknown as CombatScene)

    expect(gourd.resolveRewardSourcePoint(PLAYER_ID)).toEqual(
      gourd.resolveRewardSourcePoint('mortal_wild_boar_1'),
    )
    expect(gourd.resolveRewardSourcePoint(PLAYER_ID)).toEqual({ x: 300, y: 440 })
  })
})
