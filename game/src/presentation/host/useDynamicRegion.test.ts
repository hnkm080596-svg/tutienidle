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

interface FakeGame {
  registry: { get: (k: string) => unknown; set: (k: string, v: unknown) => void }
  scale: { resize: ReturnType<typeof vi.fn> }
  events: {
    once: (name: string, fn: () => void) => void
    emit: ReturnType<typeof vi.fn>
  }
  destroy: ReturnType<typeof vi.fn>
}

const trace: string[] = []
let readyCallbacks: Array<() => void> = []
let observers: Array<{ disconnect: ReturnType<typeof vi.fn> }> = []

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

      events = {
        once: (name: string, fn: () => void) => {
          if (name === 'ready') readyCallbacks.push(fn)
        },
        emit: vi.fn(),
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
