import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PhaserSceneAdapter } from './PhaserSceneAdapter'

interface FakeSceneManager {
  isActive: (key: string) => boolean
  start: import('vitest').Mock
  stop: import('vitest').Mock
  getScene: import('vitest').Mock
}

function createFakeGame() {
  const activeScenes = new Set<string>()
  const sceneInstances = new Map<string, Record<string, unknown>>()

  const sceneMock: FakeSceneManager = {
    isActive: (key: string) => activeScenes.has(key),
    start: vi.fn((key: string, data?: unknown) => {
      activeScenes.add(key)
      const instance = sceneInstances.get(key)
      if (instance?.onStart) {
        ;(instance.onStart as (d: unknown) => void)(data)
      }
    }),
    stop: vi.fn((key: string) => {
      activeScenes.delete(key)
    }),
    getScene: vi.fn((key: string) => sceneInstances.get(key)),
  }

  const game = {
    scene: sceneMock,
    _activeScenes: activeScenes,
    _sceneInstances: sceneInstances,
  }

  return game
}

describe('PhaserSceneAdapter', () => {
  let adapter: PhaserSceneAdapter
  let fakeGame: ReturnType<typeof createFakeGame>

  beforeEach(() => {
    adapter = new PhaserSceneAdapter()
    fakeGame = createFakeGame()
    adapter.setGame(fakeGame as unknown as import('phaser').Game)
  })

  it('handles synchronous reportReady during scene activation', async () => {
    // Scene calls reportReady synchronously when started
    fakeGame.scene.start = vi.fn((key: string, data?: unknown) => {
      fakeGame._activeScenes.add(key)
      const context = data as { transitionId: number; sessionId?: number }
      adapter.reportReady({
        transitionId: context.transitionId,
        sessionId: context.sessionId,
      })
    })

    const signal = new AbortController().signal
    await expect(
      adapter.prepare({ target: 'home' }, 1, signal),
    ).resolves.toBeUndefined()

    expect(adapter.getActivePrimarySceneKey()).toBe('MainScene')
    expect(fakeGame.scene.start).toHaveBeenCalledWith('MainScene', {
      transitionId: 1,
      sessionId: undefined,
    })
  })

  it('resolves immediately for non-Phaser routes without touching game.scene', async () => {
    const signal = new AbortController().signal

    await adapter.prepare({ target: 'auth' }, 2, signal)
    expect(fakeGame.scene.start).not.toHaveBeenCalled()

    await adapter.prepare({ target: 'boot' }, 3, signal)
    expect(fakeGame.scene.start).not.toHaveBeenCalled()
  })

  it('stops previous primary scene before activating next primary', async () => {
    const signal = new AbortController().signal

    // First: activate MainScene
    fakeGame.scene.start = vi.fn((key, data) => {
      fakeGame._activeScenes.add(key)
      adapter.reportReady({ transitionId: (data as any).transitionId })
    })

    await adapter.prepare({ target: 'home' }, 1, signal)
    expect(adapter.getActivePrimarySceneKey()).toBe('MainScene')
    expect(fakeGame.scene.start).toHaveBeenCalledWith('MainScene', expect.anything())

    // Next: activate CombatScene -> MainScene must be stopped
    const session = { kind: 'combat' as const, sessionId: 10 }
    await adapter.prepare({ target: 'combat', session }, 2, signal)

    expect(fakeGame.scene.stop).toHaveBeenCalledWith('MainScene')
    expect(fakeGame.scene.start).toHaveBeenCalledWith('CombatScene', expect.anything())
    expect(adapter.getActivePrimarySceneKey()).toBe('CombatScene')
  })

  it('performs same-route rebind for combat when CombatScene is already active', async () => {
    const signal = new AbortController().signal
    const rebindSpy = vi.fn((ctx) => {
      adapter.reportReady(ctx)
    })

    fakeGame._sceneInstances.set('CombatScene', {
      rebindSession: rebindSpy,
    })

    // Put adapter in combat route
    fakeGame.scene.start = vi.fn((key, data) => {
      fakeGame._activeScenes.add(key)
      adapter.reportReady(data as any)
    })
    await adapter.prepare(
      { target: 'combat', session: { kind: 'combat', sessionId: 1 } },
      1,
      signal,
    )
    fakeGame.scene.start.mockClear()

    // Second combat session: same-route rebind
    await adapter.prepare(
      { target: 'combat', session: { kind: 'combat', sessionId: 2 } },
      2,
      signal,
    )

    // Must NOT destroy or restart scene via scene.start
    expect(fakeGame.scene.start).not.toHaveBeenCalled()
    expect(rebindSpy).toHaveBeenCalledWith({ transitionId: 2, sessionId: 2 })
  })

  it('rejects stale reportReady call from old transitionId or game generation', async () => {
    const signal = new AbortController().signal

    // Start preparation (which doesn't report ready immediately)
    const prepPromise = adapter.prepare({ target: 'home' }, 1, signal)

    // Stale transitionId does not resolve
    expect(adapter.reportReady({ transitionId: 999 })).toBe(false)

    // Stale game generation does not resolve
    expect(adapter.reportReady({ transitionId: 1, gameGeneration: 999 })).toBe(false)

    // Correct transition resolves
    expect(adapter.reportReady({ transitionId: 1 })).toBe(true)
    await expect(prepPromise).resolves.toBeUndefined()
  })

  it('rejects pending waiter when game is destroyed / replaced mid-preparation', async () => {
    const signal = new AbortController().signal
    const prepPromise = adapter.prepare({ target: 'home' }, 1, signal)

    // Game destroyed / unmounted
    adapter.setGame(null)

    await expect(prepPromise).rejects.toThrow('Game instance replaced or destroyed')
  })

  it('propagates error when scene.start throws on create', async () => {
    fakeGame.scene.start = vi.fn(() => {
      throw new Error('Scene create error')
    })

    const signal = new AbortController().signal
    await expect(
      adapter.prepare({ target: 'home' }, 1, signal),
    ).rejects.toThrow('Scene create error')
  })

  it('waits for game ready when prepare is called before game host is set', async () => {
    const lateAdapter = new PhaserSceneAdapter()
    const signal = new AbortController().signal

    // When game starts scene, report ready
    fakeGame.scene.start = vi.fn((key, data) => {
      fakeGame._activeScenes.add(key)
      lateAdapter.reportReady({ transitionId: (data as any).transitionId })
    })

    const prepPromise = lateAdapter.prepare({ target: 'home' }, 1, signal)

    // Simulate game host creation after delay
    lateAdapter.setGame(fakeGame as unknown as import('phaser').Game)

    await expect(prepPromise).resolves.toBeUndefined()
  })
})
