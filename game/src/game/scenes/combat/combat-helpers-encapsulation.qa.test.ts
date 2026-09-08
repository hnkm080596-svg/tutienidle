// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { CombatCastBar } from './combat-cast-bar'
import { CombatPositionInterpolation } from './combat-position-interpolation'
import type { CombatScene } from '../CombatScene'

// AR-29 QA Probe:
// Scene helpers (CombatCastBar and CombatPositionInterpolation) must encapsulate
// and own their respective state maps, rather than directly mutating the parent scene.

function makeMockScene(): CombatScene {
  return {
    spriteFor: vi.fn(),
    characterWidth: 64,
    entityHeadY: () => 100,
    add: {
      rectangle: () => ({
        setOrigin: vi.fn().mockReturnThis(),
        setStrokeStyle: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      }),
    },
    tweens: {
      add: vi.fn(),
      killTweensOf: vi.fn(),
    },
    time: { now: 1000 },
  } as unknown as CombatScene
}

describe('AR-29: Encapsulation of scene helpers', () => {
  it('CombatCastBar encapsulates and manages its own castBars map', () => {
    const scene = makeMockScene()
    const castBarHelper = new CombatCastBar(scene)

    expect(castBarHelper.castBars).toBeInstanceOf(Map)
    expect(castBarHelper.castBars.size).toBe(0)

    // Manual destroy on empty does not throw
    expect(() => castBarHelper.destroyCastBar('non_existent')).not.toThrow()
  })

  it('CombatPositionInterpolation encapsulates and manages its own interpolations map', () => {
    const scene = makeMockScene()
    const interpolationHelper = new CombatPositionInterpolation(scene)

    expect(interpolationHelper.interpolations).toBeInstanceOf(Map)
    expect(interpolationHelper.interpolations.size).toBe(0)

    interpolationHelper.snapInterpolationTarget('player', 100, 1000)
    expect(interpolationHelper.interpolations.has('player')).toBe(true)
    expect(interpolationHelper.interpolations.get('player')?.toX).toBe(100)
  })
})
