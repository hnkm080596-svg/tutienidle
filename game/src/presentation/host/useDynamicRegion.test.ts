// @vitest-environment jsdom
//
// The host's contract is its ORDERING, not its API surface (§5.2). These tests
// assert the parts that are load-bearing: a teardown mid-import must leave no
// game behind, teardown must disconnect the observer before destroying the
// game, and a 'ready' that arrives after teardown must not be delivered.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref, type App, type Ref } from 'vue'
import {
  useDynamicRegion,
  type DynamicRegion,
  type DynamicRegionModules,
} from './useDynamicRegion'

interface FakeScene {
  sys: { settings: { status: number } }
  events: { once: (name: string, fn: () => void) => void }
  fireCreate: () => void
}

interface FakeGame {
  registry: { get: (k: string) => unknown; set: (k: string, v: unknown) => void }
  scale: { resize: ReturnType<typeof vi.fn> }
  scene: { scenes: FakeScene[] }
  events: {
    once: (name: string, fn: () => void) => void
    emit: ReturnType<typeof vi.fn>
  }
  destroy: ReturnType<typeof vi.fn>
}

const trace: string[] = []
let readyCallbacks: Array<() => void> = []
let observers: Array<{ disconnect: ReturnType<typeof vi.fn> }> = []
let games: FakeGame[] = []

function makeFakeScene(started: boolean): FakeScene {
  const createCallbacks: Array<() => void> = []

  const scene: FakeScene = {
    // Phaser boots only scenes queued to start (autoStart/active): init()
    // runs inside bootQueue, so by the time 'ready' listeners run a started
    // scene sits at INIT(1)+ with create() still pending on its loader. A
    // scene never started stays PENDING(0) and its create() may never run
    // at all (e.g. a dormant combat scene waiting on a later scene.start()).
    sys: { settings: { status: started ? 1 : 0 } },
    events: {
      once: (name: string, fn: () => void) => {
        if (name === 'create') createCallbacks.push(fn)
      },
    },
    fireCreate: () => {
      scene.sys.settings.status = 5
      createCallbacks.splice(0).forEach((fn) => fn())
    },
  }

  return scene
}

function makeFakePhaser() {
  return {
    AUTO: 0,
    Game: class {
      private readonly store = new Map<string, unknown>()

      registry = {
        get: (key: string) => this.store.get(key),
        set: (key: string, value: unknown) => void this.store.set(key, value),
      }

      scale = { resize: vi.fn() }

      // Real Phaser instantiates scenes inside bootQueue (a 'ready'
      // listener) — the fake mirrors that: instances exist once 'ready'
      // listeners run, but their create() stays pending until tests fire it.
      scene: { scenes: FakeScene[] }

      events = {
        once: (name: string, fn: () => void) => {
          if (name === 'ready') {
            readyCallbacks.push(() => {
              this.scene = {
                scenes: this.pendingScenes.map((entry) =>
                  makeFakeScene(
                    !(entry !== null && typeof entry === 'object' && 'dormant' in entry),
                  ),
                ),
              }
              fn()
            })
          }
        },
        emit: vi.fn(),
      }

      private readonly pendingScenes: unknown[]

      constructor(config: { scene?: unknown[] }) {
        this.pendingScenes = config.scene ?? []
        this.scene = { scenes: [] }
        games.push(this as unknown as FakeGame)
      }

      destroy = vi.fn(() => trace.push('destroy'))
    },
    // A real Phaser.Game has thirty-odd more members, none of which the host
    // touches. Widening the fake to satisfy the compiler would be pretending
    // the host uses them.
  } as unknown as DynamicRegionModules['Phaser']
}

/** Mounts a component so the composable has an instance to unmount from. */
function mountWith(build: () => DynamicRegion): { app: App; region: DynamicRegion } {
  let region!: DynamicRegion

  const app = createApp(
    defineComponent({
      setup() {
        region = build()

        return () => h('div')
      },
    }),
  )

  app.mount(document.createElement('div'))

  return { app, region }
}

beforeEach(() => {
  trace.length = 0
  readyCallbacks = []
  observers = []
  games = []

  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn(() => trace.push('disconnect'))

      constructor() {
        observers.push(this as unknown as { disconnect: ReturnType<typeof vi.fn> })
      }
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function container(): Ref<HTMLElement | null> {
  const element = document.createElement('div')

  Object.defineProperty(element, 'clientWidth', { value: 800 })
  Object.defineProperty(element, 'clientHeight', { value: 600 })

  return ref<HTMLElement | null>(element)
}

describe('useDynamicRegion', () => {
  it('seeds the gate before anything is told the region booted', async () => {
    const order: string[] = []

    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => ({ Phaser: makeFakePhaser(), scenes: [] }),
        seed: () => void order.push('seed'),
        onBooted: () => order.push('booted'),
      }),
    )

    region.start()
    await vi.waitFor(() => expect(order).toHaveLength(2))

    expect(order).toEqual(['seed', 'booted'])
  })

  it('a teardown mid-import leaves no game behind', async () => {
    let resolveLoad: (() => void) | null = null

    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => {
          await new Promise<void>((resolve) => {
            resolveLoad = resolve
          })

          return { Phaser: makeFakePhaser(), scenes: [] }
        },
        onBooted: () => trace.push('booted'),
      }),
    )

    region.start()
    await vi.waitFor(() => expect(resolveLoad).not.toBeNull())

    // The panel closes, or the component unmounts, while the chunk is still in
    // flight. The import then resolves into a region that no longer exists.
    region.destroy()
    resolveLoad!()

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(trace).not.toContain('booted')
  })

  it('disconnects the observer before destroying the game', async () => {
    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => ({ Phaser: makeFakePhaser(), scenes: [] }),
      }),
    )

    region.start()
    await vi.waitFor(() => expect(observers).toHaveLength(1))

    region.destroy()

    // A game destroyed first can still be resized by an observer that is still
    // connected - §5.2's teardown order exists to make that impossible.
    expect(trace).toEqual(['disconnect', 'destroy'])
  })

  it('does not deliver a ready that arrives after teardown', async () => {
    const onReady = vi.fn()

    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => ({ Phaser: makeFakePhaser(), scenes: [] }),
        onReady,
      }),
    )

    region.start()
    await vi.waitFor(() => expect(readyCallbacks).toHaveLength(1))

    region.destroy()
    readyCallbacks[0]!()

    expect(onReady).not.toHaveBeenCalled()
  })

  it('queues dispatches until scenes have run create(), then replays in order', async () => {
    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => ({ Phaser: makeFakePhaser(), scenes: [class {} as never] }),
      }),
    )

    region.start()
    await vi.waitFor(() => expect(games).toHaveLength(1))

    const game = games[0]!

    region.dispatch('evt', 'first')
    readyCallbacks[0]!() // game 'ready' — scene create() still pending
    region.dispatch('evt', 'second')

    expect(game.events.emit).not.toHaveBeenCalled()

    game.scene.scenes[0]!.fireCreate()

    expect(game.events.emit.mock.calls).toEqual([
      ['evt', 'first'],
      ['evt', 'second'],
    ])

    region.dispatch('evt', 'third')

    expect(game.events.emit.mock.calls).toHaveLength(3)
  })

  it('onReady waits for scene create(), not just game ready', async () => {
    const onReady = vi.fn()

    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => ({ Phaser: makeFakePhaser(), scenes: [class {} as never] }),
        onReady,
      }),
    )

    region.start()
    await vi.waitFor(() => expect(readyCallbacks).toHaveLength(1))

    readyCallbacks[0]!()

    expect(onReady).not.toHaveBeenCalled()

    games[0]!.scene.scenes[0]!.fireCreate()

    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('a scene registered but never started (PENDING) does not block region readiness', async () => {
    const onReady = vi.fn()

    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => ({
          Phaser: makeFakePhaser(),
          scenes: [class {} as never, { dormant: true } as never],
        }),
        onReady,
      }),
    )

    region.start()
    await vi.waitFor(() => expect(readyCallbacks).toHaveLength(1))

    readyCallbacks[0]!()

    // Only the started scene gates readiness; its create() completes it.
    games[0]!.scene.scenes[0]!.fireCreate()

    expect(onReady).toHaveBeenCalledTimes(1)

    // A late create() from the dormant scene (scene.start() later on) is
    // harmless — the region is already ready and dispatches pass through.
    games[0]!.scene.scenes[1]!.fireCreate()

    region.dispatch('evt', 'after')

    expect(games[0]!.events.emit).toHaveBeenCalledWith('evt', 'after')
  })

  it('a teardown before scene create drops the queue with the generation', async () => {
    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => ({ Phaser: makeFakePhaser(), scenes: [class {} as never] }),
      }),
    )

    region.start()
    await vi.waitFor(() => expect(games).toHaveLength(1))

    const game = games[0]!

    region.dispatch('evt', 'first')
    readyCallbacks[0]!()
    region.destroy()

    game.scene.scenes[0]!.fireCreate()

    expect(game.events.emit).not.toHaveBeenCalled()
  })

  it('runs the seed cleanup at teardown', async () => {
    const cleanup = vi.fn()

    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => ({ Phaser: makeFakePhaser(), scenes: [] }),
        seed: () => cleanup,
      }),
    )

    region.start()
    await vi.waitFor(() => expect(observers).toHaveLength(1))

    region.destroy()

    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('reports a failed import locally, without throwing', async () => {
    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => {
          throw new Error('chunk load failed')
        },
      }),
    )

    region.start()
    await vi.waitFor(() => expect(region.bootError.value).not.toBeNull())

    expect(region.bootError.value).toContain('chunk load failed')
  })

  it('start() again after a failed bootstrap retries and clears bootError (ARCH-013/L04)', async () => {
    // The coordinator-retry host hook (PhaserCanvas) depends on this: a
    // failed bootstrap leaves game === null, so a later start() must run a
    // NEW import — before this existed, nothing ever re-invoked start().
    let attempts = 0

    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => {
          attempts += 1
          if (attempts === 1) {
            throw new Error('chunk load failed')
          }
          return { Phaser: makeFakePhaser(), scenes: [] }
        },
        onBooted: () => trace.push('booted'),
      }),
    )

    region.start()
    await vi.waitFor(() => expect(region.bootError.value).not.toBeNull())
    expect(attempts).toBe(1)

    region.start()

    await vi.waitFor(() => expect(games).toHaveLength(1))
    expect(attempts).toBe(2)
    expect(region.bootError.value).toBeNull()
    expect(trace).toContain('booted')
  })

  it('a repeat start() during the same pending import does not double-boot', async () => {
    let attempts = 0
    let resolveLoad: (() => void) | null = null

    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => {
          attempts += 1
          await new Promise<void>((resolve) => {
            resolveLoad = resolve
          })
          return { Phaser: makeFakePhaser(), scenes: [] }
        },
      }),
    )

    region.start()
    region.start() // same generation, import still in flight — dedupe

    await vi.waitFor(() => expect(resolveLoad).not.toBeNull())
    resolveLoad!()

    await vi.waitFor(() => expect(games).toHaveLength(1))
    expect(attempts).toBe(1)
  })

  it('start() after teardown begins a NEW attempt even while the old import is still pending', async () => {
    // TranPhapPanel's close-mid-import -> reopen path: destroy() bumps the
    // generation, so the still-pending import is already stale — a reopen
    // must not dedupe against it and wait forever on a dead boot.
    let attempts = 0
    const resolvers: Array<() => void> = []

    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => {
          const index = attempts
          attempts += 1
          await new Promise<void>((resolve) => {
            resolvers[index] = resolve
          })
          return { Phaser: makeFakePhaser(), scenes: [] }
        },
        onBooted: () => trace.push('booted'),
      }),
    )

    region.start()
    await vi.waitFor(() => expect(attempts).toBe(1))

    region.destroy()
    region.start()

    await vi.waitFor(() => expect(attempts).toBe(2))

    resolvers[0]!() // stale import resolves — must not boot
    resolvers[1]!() // current import resolves — boots

    await vi.waitFor(() => expect(trace).toContain('booted'))
    expect(games).toHaveLength(1)
  })

  it('a fixed-size region observes nothing', async () => {
    const { region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        size: { width: 420, height: 480 },
        load: async () => ({ Phaser: makeFakePhaser(), scenes: [] }),
        onBooted: () => trace.push('booted'),
      }),
    )

    region.start()
    await vi.waitFor(() => expect(trace).toContain('booted'))

    expect(observers).toHaveLength(0)
  })

  it('tears down when the component unmounts, with no explicit destroy', async () => {
    const { app, region } = mountWith(() =>
      useDynamicRegion({
        container: container(),
        load: async () => ({ Phaser: makeFakePhaser(), scenes: [] }),
      }),
    )

    region.start()
    await vi.waitFor(() => expect(observers).toHaveLength(1))

    app.unmount()

    expect(trace).toEqual(['disconnect', 'destroy'])
  })
})
