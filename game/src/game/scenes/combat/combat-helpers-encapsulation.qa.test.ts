// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { CombatCastBar } from './combat-cast-bar'
import { CombatPositionInterpolation } from './combat-position-interpolation'
import type { CombatScene } from '../CombatScene'

// AR-29 / S3 QA Probe:
// Scene helpers (CombatCastBar and CombatPositionInterpolation) must encapsulate
// and own their respective state maps: read-only exposure only, no setter,
// mutation exclusively through the helpers' owned API. The scene-level
// passthrough must be a read-only view as well.

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
  it('CombatCastBar exposes a read-only castBars map with no replacement setter', () => {
    const scene = makeMockScene()
    const castBarHelper = new CombatCastBar(scene)

    expect(castBarHelper.castBars).toBeInstanceOf(Map)
    expect(castBarHelper.castBars.size).toBe(0)

    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(castBarHelper),
      'castBars',
    )

    expect(descriptor?.get).toBeTypeOf('function')
    expect(descriptor?.set).toBeUndefined()

    // Manual destroy on empty does not throw
    expect(() => castBarHelper.destroyCastBar('non_existent')).not.toThrow()
  })

  it('CombatPositionInterpolation exposes a read-only interpolations map with no replacement setter', () => {
    const interpolationHelper = new CombatPositionInterpolation(() => 1000)

    expect(interpolationHelper.interpolations).toBeInstanceOf(Map)
    expect(interpolationHelper.interpolations.size).toBe(0)

    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(interpolationHelper),
      'interpolations',
    )

    expect(descriptor?.get).toBeTypeOf('function')
    expect(descriptor?.set).toBeUndefined()

    // State changes only through the owned API, read back through the view.
    interpolationHelper.snapInterpolationTarget('player', 100, 1000)
    expect(interpolationHelper.interpolations.has('player')).toBe(true)
    expect(interpolationHelper.interpolations.get('player')?.toX).toBe(100)

    // Owned mutation API: delete/clear remain the only removal paths.
    interpolationHelper.delete('player')
    expect(interpolationHelper.interpolations.has('player')).toBe(false)
  })
})
