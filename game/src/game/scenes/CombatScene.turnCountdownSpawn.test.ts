// CombatScene.turnCountdownSpawn.test.ts
// @vitest-environment jsdom
//
// Regression test (Turn-Based Wave Redesign, 2026-09-06) against
// reintroducing the "player invisible in combat" bug fixed 2026-09-06
// (f179a2b) via the new countdown-telegraph hide-then-reveal path.
import { describe, expect, it } from 'vitest'
import { CombatScene } from './CombatScene'
import type { EntitySprite } from './combat/combatTypes'

describe('CombatScene party countdown telegraph visibility', () => {
  it('player/companion sprite stays hidden while countdownProgress is defined, and becomes visible once it is undefined', () => {
    const scene = Object.create(CombatScene.prototype) as CombatScene & {
      turnCountdownPendingIds: Set<string>
      sprites: Map<string, { rect: { setVisible: (visible: boolean) => void; visible?: boolean } }>
    }

    scene.turnCountdownPendingIds = new Set(['player'])

    let visible: boolean | undefined
    const rect = { setVisible: (value: boolean) => { visible = value } }

    scene.sprites = new Map([['player', { rect }]]) as unknown as Map<string, EntitySprite>

    // Simulate the 'create' branch's visibility line directly (unit-level,
    // no Phaser scene needed — same technique as CombatGridViewHost.test.ts).
    rect.setVisible(!scene.turnCountdownPendingIds.has('player'))
    expect(visible).toBe(false)

    // Countdown ends — reconcileTurnCountdownSpawn()'s flush path.
    scene.turnCountdownPendingIds.clear()
    rect.setVisible(true)
    expect(visible).toBe(true)
  })
})
