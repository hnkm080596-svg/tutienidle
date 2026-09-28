// Pure component tests for the surviving helper - the action_impact spawn
// path it used to serve is deleted (skill presentation owns impact visuals).
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import Phaser from 'phaser'
import { toVector2Points } from './ActionImpactVfx'

describe('toVector2Points', () => {
  it('converts plain points to Vector2 in order', () => {
    const vectors = toVector2Points([{ x: 1, y: 2 }, { x: 3.5, y: -4 }])
    expect(vectors).toHaveLength(2)
    expect(vectors[0]).toBeInstanceOf(Phaser.Math.Vector2)
    expect(vectors[0]!.x).toBe(1)
    expect(vectors[0]!.y).toBe(2)
    expect(vectors[1]!.x).toBe(3.5)
    expect(vectors[1]!.y).toBe(-4)
  })
})
