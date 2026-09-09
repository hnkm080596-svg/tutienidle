import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GamePresentationCoordinator,
  type CoordinatorDeps,
} from './GamePresentationCoordinator'
import type {
  AssetPort,
  CoordinatorSnapshot,
  CurtainPort,
  DeadlineScheduler,
  RendererPort,
  RouteRequest,
} from './PresentationContracts'
import {
  PresentationSession,
  type SessionPresentationPort,
} from '../core/presentation/PresentationSession'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

async function flushTicks(count = 5) {
  for (let i = 0; i < count; i++) {
    await Promise.resolve()
  }
}

describe('GamePresentationCoordinator', () => {
  let sessionPort: SessionPresentationPort
  let renderer: RendererPort
  let curtain: CurtainPort
  let assets: AssetPort
  let callLog: string[]

  beforeEach(() => {
    sessionPort = new PresentationSession()
    callLog = []

    renderer = {
      prepare: vi.fn(async () => {
        callLog.push('renderer.prepare')
      }),
      deactivate: vi.fn(async () => {
        callLog.push('renderer.deactivate')
      }),
    }

    curtain = {
      close: vi.fn(async () => {
        callLog.push('curtain.close')
      }),
      open: vi.fn(async () => {
        callLog.push('curtain.open')
      }),
    }

    assets = {
      ensureFor: vi.fn(async () => {
        callLog.push('assets.ensureFor')
      }),
    }
  })

  function createCoordinator(overrides: Partial<CoordinatorDeps> = {}) {
    return new GamePresentationCoordinator({
      sessionPort,
      renderer,
      curtain,
      assets,
      initialRoute: 'home',
      ...overrides,
    })
  }

  it('executes full ordered kernel and verifies state at each deferred step', async () => {
    const closeDef = deferred()
    const assetsDef = deferred()
    const deactDef = deferred()
    const prepareDef = deferred()
    const openDef = deferred()

    curtain.close = vi.fn(() => {
      callLog.push('curtain.close')
      return closeDef.promise
    })
    assets.ensureFor = vi.fn(() => {
      callLog.push('assets.ensureFor')
      return assetsDef.promise
    })
    renderer.deactivate = vi.fn(() => {
      callLog.push('renderer.deactivate')
      return deactDef.promise
    })
    renderer.prepare = vi.fn(() => {
      callLog.push('renderer.prepare')
      return prepareDef.promise
    })
    curtain.open = vi.fn(() => {
      callLog.push('curtain.open')
      return openDef.promise
    })

    const coordinator = createCoordinator({ initialRoute: 'home' })
    const session = { kind: 'combat' as const, sessionId: 1 }
    // Start session in interactive mode
    sessionPort.hold(session) // prime session or begin on port
    const portSession = sessionPort as PresentationSession
    portSession.begin(session, 'interactive')

    const snapshots: CoordinatorSnapshot[] = []
    coordinator.subscribe((s) => snapshots.push(s))

    const requestPromise = coordinator.request({ target: 'combat', session })

    // Step: closing curtain
    expect(coordinator.getSnapshot().phase).toBe('closing')
    expect(coordinator.getSnapshot().renderRoute).toBeNull()
    expect(coordinator.getSnapshot().currentRoute).toBe('home')
    expect(callLog).toEqual(['curtain.close'])
    closeDef.resolve()
    await flushTicks()

    // Step: loading assets
    expect(coordinator.getSnapshot().phase).toBe('loading')
    expect(coordinator.getSnapshot().renderRoute).toBeNull()
    expect(callLog).toEqual(['curtain.close', 'assets.ensureFor'])
    assetsDef.resolve()
    await flushTicks()

    // Step: deactivating prior renderer
    expect(callLog).toEqual(['curtain.close', 'assets.ensureFor', 'renderer.deactivate'])
    deactDef.resolve()
    await flushTicks()

    // Step: activating & awaiting-ready
    expect(coordinator.getSnapshot().renderRoute).toBe('combat')
    expect(coordinator.getSnapshot().currentRoute).toBe('home') // NOT committed yet!
    expect(portSession.isBlocking()).toBe(true) // NOT released yet!
    expect(callLog).toEqual(['curtain.close', 'assets.ensureFor', 'renderer.deactivate', 'renderer.prepare'])
    prepareDef.resolve()
    await flushTicks()

    // Step: opening curtain (committed currentRoute)
    expect(coordinator.getSnapshot().currentRoute).toBe('combat')
    expect(coordinator.getSnapshot().renderRoute).toBeNull()
    expect(portSession.isBlocking()).toBe(true) // Still held during opening!
    expect(callLog).toEqual(['curtain.close', 'assets.ensureFor', 'renderer.deactivate', 'renderer.prepare', 'curtain.open'])
    openDef.resolve()
    await flushTicks()

    const result = await requestPromise
    expect(result.status).toBe('entered')

    // Final: idle and unblocked
    expect(coordinator.getSnapshot().phase).toBe('idle')
    expect(coordinator.getSnapshot().currentRoute).toBe('combat')
    expect(portSession.isBlocking()).toBe(false)
  })

  it('handles synchronous READY cleanly', async () => {
    const coordinator = createCoordinator({ initialRoute: 'home' })
    const session = { kind: 'combat' as const, sessionId: 2 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    const result = await coordinator.request({ target: 'combat', session })
    expect(result.status).toBe('entered')
    expect(coordinator.getSnapshot().currentRoute).toBe('combat')
    expect(coordinator.getSnapshot().phase).toBe('idle')
  })

  it('fails transition and keeps session held when prepare times out (missing READY)', async () => {
    vi.useFakeTimers()
    try {
      const prepareDef = deferred()
      renderer.prepare = vi.fn(() => prepareDef.promise)

      const coordinator = createCoordinator({ initialRoute: 'home' })
      const session = { kind: 'combat' as const, sessionId: 3 }
      ;(sessionPort as PresentationSession).begin(session, 'interactive')

      const requestPromise = coordinator.request({ target: 'combat', session })
      await flushTicks()

      // Advance timers by the prepareReady deadline (10,000ms)
      await vi.advanceTimersByTimeAsync(10_000)

      const result = await requestPromise
      expect(result.status).toBe('failed')

      const snapshot = coordinator.getSnapshot()
      expect(snapshot.phase).toBe('failed')
      expect(snapshot.error?.message).toContain('Renderer readiness timed out')
      expect(snapshot.renderRoute).toBeNull()

      // Law A7 & Gate: session must remain held on failure!
      expect((sessionPort as PresentationSession).isBlocking()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('shares in-flight promise for duplicate request with same route and session', async () => {
    const prepareDef = deferred()
    renderer.prepare = vi.fn(() => prepareDef.promise)

    const coordinator = createCoordinator({ initialRoute: 'home' })
    const session = { kind: 'combat' as const, sessionId: 4 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    const req1 = coordinator.request({ target: 'combat', session })
    const req2 = coordinator.request({ target: 'combat', session })

    prepareDef.resolve()
    const [res1, res2] = await Promise.all([req1, req2])

    expect(res1).toBe(res2)
    expect(res1.status).toBe('entered')
  })

  it('rejects conflicting request while transition is in flight', async () => {
    const prepareDef = deferred()
    renderer.prepare = vi.fn(() => prepareDef.promise)

    const coordinator = createCoordinator({ initialRoute: 'home' })
    const session1 = { kind: 'combat' as const, sessionId: 5 }
    const session2 = { kind: 'combat' as const, sessionId: 6 }
    ;(sessionPort as PresentationSession).begin(session1, 'interactive')

    const req1 = coordinator.request({ target: 'combat', session: session1 })
    const conflictReq = await coordinator.request({ target: 'combat', session: session2 })

    expect(conflictReq.status).toBe('rejected')

    prepareDef.resolve()
    const res1 = await req1
    expect(res1.status).toBe('entered')
  })

  it('returns unchanged for same idle healthy route and session', async () => {
    const coordinator = createCoordinator({ initialRoute: 'home' })
    const result = await coordinator.request({ target: 'home' })
    expect(result.status).toBe('unchanged')
  })

  it('rejects requests with invalid edge', async () => {
    const coordinator = createCoordinator({ initialRoute: 'combat' })
    // Combat directly to character is not an allowed edge
    const result = await coordinator.request({ target: 'character' })
    expect(result.status).toBe('rejected')
  })

  it('allows same-route rebind for combat with new session', async () => {
    const coordinator = createCoordinator({ initialRoute: 'home' })
    const session1 = { kind: 'combat' as const, sessionId: 10 }
    ;(sessionPort as PresentationSession).begin(session1, 'interactive')

    await coordinator.request({ target: 'combat', session: session1 })
    expect(coordinator.getSnapshot().currentRoute).toBe('combat')

    // New session on combat route
    const session2 = { kind: 'combat' as const, sessionId: 11 }
    ;(sessionPort as PresentationSession).begin(session2, 'interactive')

    const rebindResult = await coordinator.request({ target: 'combat', session: session2 })
    expect(rebindResult.status).toBe('entered')
    expect(coordinator.getSnapshot().currentSession?.sessionId).toBe(11)
  })

  it('fails transition and keeps session held when open curtain fails after commit', async () => {
    curtain.open = vi.fn(async () => {
      throw new Error('Curtain animation broken')
    })

    const coordinator = createCoordinator({ initialRoute: 'home' })
    const session = { kind: 'combat' as const, sessionId: 7 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    const result = await coordinator.request({ target: 'combat', session })
    expect(result.status).toBe('failed')

    const snapshot = coordinator.getSnapshot()
    expect(snapshot.phase).toBe('failed')
    expect(snapshot.error?.message).toContain('Curtain animation broken')
    // Hold must be detached with 'hold' policy (never released on failure)
    expect((sessionPort as PresentationSession).isBlocking()).toBe(true)
  })

  it('fails transition when attach returns false', async () => {
    sessionPort.attach = vi.fn(() => false)

    const coordinator = createCoordinator({ initialRoute: 'home' })
    const session = { kind: 'combat' as const, sessionId: 8 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    const result = await coordinator.request({ target: 'combat', session })
    expect(result.status).toBe('failed')
    expect(coordinator.getSnapshot().phase).toBe('failed')
    expect(coordinator.getSnapshot().error?.message).toContain('Failed to attach hold token')
  })

  it('fails transition when release returns false', async () => {
    sessionPort.release = vi.fn(() => false)

    const coordinator = createCoordinator({ initialRoute: 'home' })
    const session = { kind: 'combat' as const, sessionId: 9 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    const result = await coordinator.request({ target: 'combat', session })
    expect(result.status).toBe('failed')
    expect(coordinator.getSnapshot().phase).toBe('failed')
    expect(coordinator.getSnapshot().error?.message).toContain('Failed to release hold token')
  })

  it('allows retrying a failed target with the same valid session', async () => {
    let shouldFail = true
    renderer.prepare = vi.fn(async () => {
      if (shouldFail) throw new Error('First attempt failed')
    })

    const coordinator = createCoordinator({ initialRoute: 'home' })
    const session = { kind: 'combat' as const, sessionId: 20 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    const attempt1 = await coordinator.request({ target: 'combat', session })
    expect(attempt1.status).toBe('failed')
    expect(coordinator.getSnapshot().phase).toBe('failed')

    // Second attempt (retry same session) succeeds
    shouldFail = false
    const attempt2 = await coordinator.request({ target: 'combat', session })
    expect(attempt2.status).toBe('entered')
    expect(attempt2.transitionId).toBeGreaterThan(attempt1.transitionId)
    expect(coordinator.getSnapshot().phase).toBe('idle')
    expect(coordinator.getSnapshot().currentRoute).toBe('combat')
  })

  it('dispose aborts in-flight transition and unsubscribes listeners', async () => {
    const prepareDef = deferred()
    renderer.prepare = vi.fn(() => prepareDef.promise)

    const coordinator = createCoordinator({ initialRoute: 'home' })
    const session = { kind: 'combat' as const, sessionId: 30 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    const req = coordinator.request({ target: 'combat', session })
    coordinator.dispose()

    const res = await req
    expect(res.status).toBe('failed')

    // Further requests rejected
    const afterDispose = await coordinator.request({ target: 'home' })
    expect(afterDispose.status).toBe('rejected')
  })

  it('aborts the transition signal on failure so scoped waiters are torn down', async () => {
    let capturedSignal: AbortSignal | undefined
    const stuck = deferred()
    renderer.prepare = vi.fn((_req, _id, signal: AbortSignal) => {
      capturedSignal = signal
      return stuck.promise
    })

    const scheduler: DeadlineScheduler = {
      set: (callback) => {
        // Fire every deadline immediately: prepare never reports READY.
        const handle = setTimeout(callback, 0)
        return handle
      },
      clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    }

    const coordinator = createCoordinator({ initialRoute: 'boot', scheduler })
    const result = await coordinator.request({ target: 'home' })

    expect(result.status).toBe('failed')
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('retry re-runs the failed request under a fresh transition id and clears the error', async () => {
    let failNext = true
    renderer.prepare = vi.fn(async () => {
      if (failNext) {
        failNext = false
        throw new Error('scene create exploded')
      }
    })

    const coordinator = createCoordinator({ initialRoute: 'boot' })

    const first = await coordinator.request({ target: 'home' })
    expect(first.status).toBe('failed')
    expect(coordinator.getSnapshot().error?.failedRequest.target).toBe('home')

    const retried = await coordinator.retry()

    expect(retried.status).toBe('entered')
    expect(retried.transitionId).toBeGreaterThan(first.transitionId)
    expect(coordinator.getSnapshot().error).toBeNull()
    expect(coordinator.getSnapshot().currentRoute).toBe('home')
  })

  it('retry rejects when the failed session is no longer the current session', async () => {
    renderer.prepare = vi.fn(async () => {
      throw new Error('scene create exploded')
    })

    const coordinator = createCoordinator({ initialRoute: 'home' })
    const session = { kind: 'combat' as const, sessionId: 77 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    const failed = await coordinator.request({ target: 'combat', session })
    expect(failed.status).toBe('failed')

    // Domain moved on: the old session is gone, so retry must not resurrect it.
    ;(sessionPort as PresentationSession).end(session)

    const retried = await coordinator.retry()

    expect(retried.status).toBe('rejected')
    expect(coordinator.getSnapshot().currentRoute).toBe('home')
  })

  it('retry with no recorded failure is rejected', async () => {
    const coordinator = createCoordinator({ initialRoute: 'home' })

    expect((await coordinator.retry()).status).toBe('rejected')
  })

  it('canEnter reports admissibility without allocating a transition', async () => {
    const coordinator = createCoordinator({ initialRoute: 'home' })

    expect(coordinator.canEnter('combat')).toBe(true)
    expect(coordinator.canEnter('character')).toBe(false)
    expect(coordinator.getSnapshot().transitionId).toBe(0)
    expect(coordinator.getSnapshot().phase).toBe('idle')

    // While a transition is in flight nothing else may be admitted.
    const gate = deferred()
    curtain.close = vi.fn(() => gate.promise)
    const pending = coordinator.request({ target: 'combat', session: startedSession(12) })
    await flushTicks()

    expect(coordinator.canEnter('tribulation')).toBe(false)

    gate.resolve()
    await pending
  })

  it('canEnter is false for a disallowed edge, which is what keeps a boot-stuck route from accepting combat', () => {
    const coordinator = createCoordinator({ initialRoute: 'boot' })

    expect(coordinator.canEnter('combat')).toBe(false)
    expect(coordinator.canEnter('home')).toBe(true)
  })

  function startedSession(sessionId: number) {
    const session = { kind: 'combat' as const, sessionId }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')
    return session
  }

  it('provides detached snapshots to subscribers so mutations cannot affect internal state', () => {
    const coordinator = createCoordinator({ initialRoute: 'home' })
    let received: CoordinatorSnapshot | undefined
    const unsubscribe = coordinator.subscribe((s) => {
      received = s
    })

    expect(received?.currentRoute).toBe('home')

    // Unsubscribe works
    unsubscribe()
    coordinator.setShowMainMenu(true)
    expect(received?.showMainMenu).toBe(false)
  })
})
