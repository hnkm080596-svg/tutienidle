import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CompositeRenderer,
  createVueRouteAdapter,
  type VueRouteAdapter,
} from './VueRouteAdapter'
import { PhaserSceneAdapter } from './PhaserSceneAdapter'
import { GamePresentationCoordinator } from './GamePresentationCoordinator'
import { PresentationSession } from '../core/presentation/PresentationSession'

describe('CompositeRenderer and VueRouteAdapter', () => {
  let phaserAdapter: PhaserSceneAdapter
  let compositeRenderer: CompositeRenderer
  let coordinator: GamePresentationCoordinator
  let sessionPort: PresentationSession

  beforeEach(() => {
    sessionPort = new PresentationSession()
    phaserAdapter = new PhaserSceneAdapter()
    compositeRenderer = new CompositeRenderer(phaserAdapter)

    coordinator = new GamePresentationCoordinator({
      sessionPort,
      renderer: compositeRenderer,
      curtain: {
        close: vi.fn(async () => {}),
        open: vi.fn(async () => {}),
      },
      assets: {
        ensureFor: vi.fn(async () => {}),
      },
      initialRoute: 'home',
    })
  })

  it('CompositeRenderer awaits BOTH Vue ready and Phaser ready for Phaser routes', async () => {
    let resolvePhaser!: () => void
    const phaserPromise = new Promise<void>((resolve) => {
      resolvePhaser = resolve
    })

    phaserAdapter.prepare = vi.fn(async () => phaserPromise)

    const signal = new AbortController().signal
    const session = { kind: 'combat' as const, sessionId: 1 }

    const prepPromise = compositeRenderer.prepare(
      { target: 'combat', session },
      1,
      signal,
    )

    let isDone = false
    void prepPromise.then(() => {
      isDone = true
    })

    await Promise.resolve()
    expect(isDone).toBe(false)

    // 1. Vue reports ready -> still not done because Phaser is pending
    expect(compositeRenderer.reportVueReady(1)).toBe(true)
    await Promise.resolve()
    expect(isDone).toBe(false)

    // 2. Phaser finishes -> now both done!
    resolvePhaser()
    await prepPromise
    expect(isDone).toBe(true)
  })

  it('CompositeRenderer for non-Phaser route does not call phaserAdapter.prepare', async () => {
    phaserAdapter.prepare = vi.fn()

    const signal = new AbortController().signal
    const prepPromise = compositeRenderer.prepare({ target: 'auth' }, 2, signal)

    expect(phaserAdapter.prepare).not.toHaveBeenCalled()

    // Resolves once Vue reports ready
    compositeRenderer.reportVueReady(2)
    await expect(prepPromise).resolves.toBeUndefined()
  })

  it('VueRouteAdapter reflects coordinator snapshot and activeRoute accurately', async () => {
    const adapter = createVueRouteAdapter(coordinator, compositeRenderer)

    expect(adapter.currentRoute.value).toBe('home')
    expect(adapter.renderRoute.value).toBeNull()
    expect(adapter.activeRoute.value).toBe('home')
    expect(adapter.isTransitioning.value).toBe(false)
    expect(adapter.isLocked.value).toBe(false)

    // Start transition to combat (stub phaserAdapter so it doesn't wait for a game host)
    phaserAdapter.prepare = vi.fn(async () => {})
    const session = { kind: 'combat' as const, sessionId: 2 }
    sessionPort.begin(session, 'interactive')

    // Prepare holds until Vue reports ready
    const requestPromise = coordinator.request({ target: 'combat', session })

    // During transition behind curtain: renderRoute is target
    for (let i = 0; i < 20 && adapter.phase.value !== 'awaiting-ready'; i++) {
      await Promise.resolve()
    }

    expect(adapter.renderRoute.value).toBe('combat')
    expect(adapter.activeRoute.value).toBe('combat')
    expect(adapter.currentRoute.value).toBe('home') // committed route stays home until READY
    expect(adapter.isTransitioning.value).toBe(true)
    expect(adapter.isLocked.value).toBe(true)

    // Report Vue ready
    adapter.reportVueReady(adapter.transitionId.value)

    const result = await requestPromise
    expect(result.status).toBe('entered')

    // After commit and reveal
    expect(adapter.currentRoute.value).toBe('combat')
    expect(adapter.renderRoute.value).toBeNull()
    expect(adapter.activeRoute.value).toBe('combat')
    expect(adapter.isTransitioning.value).toBe(false)
    expect(adapter.isLocked.value).toBe(false)

    adapter.dispose()
  })
})
