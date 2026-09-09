import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AssetBundleManager,
  type DomImageLoader,
} from './AssetBundleManager'
import type { AssetResourceDescriptor } from './AssetBundleCatalog'
import type { AssetLoaderScene } from '@/game/scenes/AssetLoaderScene'

function createMockLoaderScene() {
  const loadedKeys = new Set<string>()
  const loadCalls: AssetResourceDescriptor[][] = []

  const mock = {
    isTextureLoaded: (key: string) => loadedKeys.has(key),
    loadDescriptors: vi.fn(async (descriptors: readonly AssetResourceDescriptor[]) => {
      loadCalls.push([...descriptors])
      for (const d of descriptors) {
        loadedKeys.add(d.key)
      }
    }),
    _loadedKeys: loadedKeys,
    _loadCalls: loadCalls,
  } as unknown as AssetLoaderScene & {
    _loadedKeys: Set<string>
    _loadCalls: AssetResourceDescriptor[][]
  }

  return mock
}

describe('AssetBundleManager', () => {
  let loaderScene: ReturnType<typeof createMockLoaderScene>
  let domImageCalls: string[]
  let domImageLoader: DomImageLoader

  beforeEach(() => {
    loaderScene = createMockLoaderScene()
    domImageCalls = []
    domImageLoader = vi.fn(async (url: string) => {
      domImageCalls.push(url)
    })
  })

  function createManager() {
    return new AssetBundleManager({
      loaderScene,
      domImageLoader,
    })
  }

  it('cached ensure resolves without repeating physical loads', async () => {
    const manager = createManager()

    await manager.ensureLoaded(['core-ui'])
    expect(loaderScene._loadCalls.length).toBe(1)

    // Second call is fully cached
    await manager.ensureLoaded(['core-ui'])
    expect(loaderScene._loadCalls.length).toBe(1)
  })

  it('concurrent ensure and prefetch deduplicate into one physical request', async () => {
    let resolveLoad!: () => void
    const blocker = new Promise<void>((resolve) => {
      resolveLoad = resolve
    })

    loaderScene.loadDescriptors = vi.fn(async (descriptors) => {
      await blocker
      for (const d of descriptors) {
        loaderScene._loadedKeys.add(d.key)
      }
    })

    const manager = createManager()

    const ensurePromise = manager.ensureLoaded(['core-ui'])
    const prefetchPromise = manager.prefetch(['core-ui'])

    resolveLoad()
    await Promise.all([ensurePromise, prefetchPromise])

    expect(loaderScene.loadDescriptors).toHaveBeenCalledTimes(1)
  })

  it('cancel A while B succeeds: A rejects with aborted, B resolves successfully', async () => {
    let resolveLoad!: () => void
    const blocker = new Promise<void>((resolve) => {
      resolveLoad = resolve
    })

    const hangingDomLoader: DomImageLoader = vi.fn(async (url, signal) => {
      await blocker
    })

    const manager = new AssetBundleManager({
      loaderScene,
      domImageLoader: hangingDomLoader,
    })

    const controllerA = new AbortController()

    const callA = manager.ensureLoaded(['home'], controllerA.signal)
    const callB = manager.ensureLoaded(['home']) // no abort signal

    controllerA.abort()

    await expect(callA).rejects.toThrow('Load aborted')

    resolveLoad()
    await expect(callB).resolves.toBeUndefined()
  })

  it('detects and rejects descriptor collisions with diagnostic message', async () => {
    const manager = createManager()

    // Prime a key
    await manager.ensureLoaded(['core-ui'])

    // Attempting to ensure a conflicting descriptor with same key but different URL
    const conflicting = [
      {
        kind: 'image' as const,
        key: 'ink-wash-ui', // collision with atlas key in core-ui
        url: '/assets/different/path.png',
      },
    ]

    expect(() => {
      // @ts-expect-error private method test
      manager.validateDescriptorCollisions(conflicting)
    }).toThrow(/Asset descriptor collision for key "ink-wash-ui"/)
  })

  it('handles error then retry: failed load rejects, subsequent retry succeeds', async () => {
    let shouldFail = true
    loaderScene.loadDescriptors = vi.fn(async (descriptors) => {
      if (shouldFail) {
        throw new Error('Network error during physical load')
      }
      for (const d of descriptors) {
        loaderScene._loadedKeys.add(d.key)
      }
    })

    const manager = createManager()

    await expect(manager.ensureLoaded(['core-ui'])).rejects.toThrow('Network error')
    expect(manager.isLoaded('core-ui')).toBe(false)

    // Retry succeeds
    shouldFail = false
    await manager.ensureLoaded(['core-ui'])
    expect(manager.isLoaded('core-ui')).toBe(true)
  })

  it('prefetch rejection is handled gracefully and does not throw', async () => {
    loaderScene.loadDescriptors = vi.fn(async () => {
      throw new Error('Prefetch failed')
    })

    const manager = createManager()

    // Prefetch must not throw
    await expect(manager.prefetch(['combat'])).resolves.toBeUndefined()
  })

  it('clears cache when loader scene is replaced (game destroyed / recreated)', async () => {
    const manager = createManager()

    await manager.ensureLoaded(['core-ui'])
    expect(manager.isLoaded('core-ui')).toBe(true)

    // New game instance creates new loader scene
    const newLoaderScene = createMockLoaderScene()
    manager.setLoaderScene(newLoaderScene)

    // Fresh game cache is empty
    expect(manager.isLoaded('core-ui')).toBe(false)
  })

  it('implements AssetPort.ensureFor routing target to corresponding bundles', async () => {
    const manager = createManager()
    const ensureSpy = vi.spyOn(manager, 'ensureLoaded')

    const signal = new AbortController().signal

    await manager.ensureFor({ target: 'home' }, signal)
    expect(ensureSpy).toHaveBeenCalledWith(['core-ui', 'home'], signal)

    await manager.ensureFor(
      { target: 'combat', session: { kind: 'combat', sessionId: 1 } },
      signal,
    )
    expect(ensureSpy).toHaveBeenCalledWith(['core-ui', 'combat'], signal)

    await manager.ensureFor(
      { target: 'tribulation', session: { kind: 'tribulation', sessionId: 2 } },
      signal,
    )
    expect(ensureSpy).toHaveBeenCalledWith(['core-ui', 'tribulation'], signal)
  })
})
