// Skill-cast impulse path: the shared presentation runner drives actor
// motion straight from the cast fact - it must never acknowledge the engine.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'

function createScene() {
  const scene = createTestScene()

  const tweenConfigs: Array<Record<string, unknown>> = []
  scene.projection = { gridToScreen: () => ({ x: 0, y: 0 }), cellSizeAt: () => ({ width: 64, height: 64 }) }
  scene.entityFootMinY = 0
  scene.entityFootMaxY = 900
  scene.tweens = { add: (config: Record<string, unknown>) => tweenConfigs.push(config),
    killTweensOf: vi.fn() }
  scene.add = {
    graphics: () => {
      const gfx = { destroyed: false, destroy: () => (gfx.destroyed = true) }
      const chain = () => new Proxy(gfx, {
        get: (obj, prop: string) =>
          prop in obj ? (obj as unknown as Record<string, unknown>)[prop] : chain,
      })
      return chain()
    },
  }
  scene.cameras = { main: { shake: vi.fn() } }
  scene.time = { now: 0, delayedCall: vi.fn() }
  scene.gameManagerRef = {
    setPresentationActive: vi.fn(),
    acknowledgeTurnReady: vi.fn(),
    acknowledgeActionImpact: vi.fn(),
    acknowledgeActionComplete: vi.fn(),
    getPendingPlaybackToken: vi.fn(() => 'playback-7'),
  }

  return { scene, tweenConfigs }
}

describe('cast-phase actor impulse', () => {
  it('moves the source sprite but never acknowledges', () => {
    const { scene, tweenConfigs } = createScene()
    scene.sprites.set('player', { kind: 'rect', rect: { x: 50, y: 0 }, offsetX: 0,
      footY: 60, personWidth: 24, personHeight: 40 } as never)
    scene.lastKnownScreenPositions = new Map([['enemy_1', { x: 400, y: 50 }]])
    scene.onSkillCast({
      ref: { sessionId: 1, requestId: '1', token: 'playback-7' },
      rootSkillId: 'tram', resolvedSkillId: 'tram', presetId: 'slash',
      source: { entityId: 'player', row: 1, column: 1 },
      declaredTargets: [{ entityId: 'enemy_1', row: 1, column: 8 }],
      candidateInstanceCount: 1, disposition: 'action',
    })
    expect(tweenConfigs.some(cfg => cfg.offsetX === 8)).toBe(true)
    expect(scene.gameManagerRef.acknowledgeActionImpact).not.toHaveBeenCalled()
  })
})
