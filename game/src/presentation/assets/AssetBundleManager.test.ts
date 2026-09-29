import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AssetBundleManager,
  type DomAudioLoader,
  type DomImageLoader,
} from './AssetBundleManager'
import {
  getBundleDescriptors,
  type AssetResourceDescriptor,
  type DomAudioResourceDescriptor,
} from './AssetBundleCatalog'
import type { AssetLoaderScene } from '@/game/scenes/AssetLoaderScene'
import { AudioManager } from '@/core/audio/AudioManager'
import { AUDIO_CUES } from '@/core/audio/AudioCueManifest'

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

  it('loader swap mid-load: the stale batch cannot publish into the new cache (ARCH-013/L04)', async () => {
    let resolveOld!: () => void
    const blocker = new Promise<void>((resolve) => {
      resolveOld = resolve
    })
    loaderScene.loadDescriptors = vi.fn(async (descriptors) => {
      await blocker
      for (const d of descriptors) {
        loaderScene._loadedKeys.add(d.key)
      }
    })

    const manager = createManager()

    // Physical load in flight on the OLD loader scene.
    const pending = manager.ensureLoaded(['core-ui'])

    // Host teardown/swap while it is still running: the result belongs to a
    // texture cache that no longer exists.
    const newLoader = createMockLoaderScene()
    manager.setLoaderScene(newLoader)
    resolveOld()

    // The stale load fails honestly — resolving it would claim success for
    // resources the CURRENT loader does not hold.
    await expect(pending).rejects.toThrow('superseded')
    expect(manager.isLoaded('core-ui')).toBe(false)

    // A fresh ensure on the new loader loads and publishes normally.
    await manager.ensureLoaded(['core-ui'])
    expect(manager.isLoaded('core-ui')).toBe(true)
    expect(newLoader._loadCalls.length).toBe(1)
  })

  it('stale batch resolution does not remove the new generation in-flight entry', async () => {
    let resolveOld!: () => void
    let resolveNew!: () => void
    const oldBlocker = new Promise<void>((resolve) => {
      resolveOld = resolve
    })
    const newBlocker = new Promise<void>((resolve) => {
      resolveNew = resolve
    })

    loaderScene.loadDescriptors = vi.fn(async (descriptors) => {
      await oldBlocker
      for (const d of descriptors) {
        loaderScene._loadedKeys.add(d.key)
      }
    })

    const newLoader = createMockLoaderScene()
    newLoader.loadDescriptors = vi.fn(async (descriptors) => {
      await newBlocker
      for (const d of descriptors) {
        newLoader._loadedKeys.add(d.key)
      }
    })

    const manager = createManager()

    const stale = manager.ensureLoaded(['core-ui']) // batch on old loader
    manager.setLoaderScene(newLoader)

    const freshA = manager.ensureLoaded(['core-ui']) // new batch on new loader
    const freshB = manager.ensureLoaded(['core-ui']) // dedupes onto freshA

    resolveOld()
    await expect(stale).rejects.toThrow('superseded')

    // If the stale continuation's finally had deleted the shared inFlight
    // entry blindly, this third ensure would start ANOTHER physical load.
    const freshC = manager.ensureLoaded(['core-ui'])
    expect(newLoader.loadDescriptors).toHaveBeenCalledTimes(1)

    resolveNew()
    await Promise.all([freshA, freshB, freshC])
    expect(manager.isLoaded('core-ui')).toBe(true)
    expect(newLoader.loadDescriptors).toHaveBeenCalledTimes(1)
  })

  it('first entry: loader registering mid-DOM-load must not fail the ensure', async () => {
    // Regression for the entry transition race: GameRoot mounts and starts
    // the Phaser host concurrently with ensureFor('home'), so the DOM image
    // loads begin while loaderScene is still null. AssetLoaderScene.create()
    // then registers the loader and bumps the generation - DOM images never
    // publish into the Phaser texture cache, so that bump must not stale them.
    let resolveDom!: () => void
    const domBlocker = new Promise<void>((resolve) => {
      resolveDom = resolve
    })
    const blockingDomLoader: DomImageLoader = vi.fn(async () => {
      await domBlocker
    })

    // No loaderScene - the host is still booting, exactly like first entry.
    const manager = new AssetBundleManager({
      domImageLoader: blockingDomLoader,
    })

    const pending = manager.ensureLoaded(['home'])
    manager.setLoaderScene(loaderScene)
    resolveDom()

    await expect(pending).resolves.toBeUndefined()
    expect(manager.isLoaded('home')).toBe(true)
  })

  it('loader swap mid-DOM-load: DOM images still commit - only the Phaser batch is fenced', async () => {
    let resolveDom!: () => void
    const domBlocker = new Promise<void>((resolve) => {
      resolveDom = resolve
    })
    const blockingDomLoader: DomImageLoader = vi.fn(async () => {
      await domBlocker
    })

    const manager = new AssetBundleManager({
      loaderScene,
      domImageLoader: blockingDomLoader,
    })

    // 'home' mixes dom-image layers with Phaser textures — both start here.
    const pending = manager.ensureLoaded(['home'])
    manager.setLoaderScene(createMockLoaderScene())
    resolveDom()

    // The Phaser batch was bound to the replaced loader's cache, so it still
    // rejects. The DOM results only live in the browser cache - a swap cannot
    // invalidate them, so they commit instead of forcing a pointless refetch.
    await expect(pending).rejects.toThrow('superseded')
    expect(manager.isLoaded('home')).toBe(false)

    for (const d of getBundleDescriptors('home')) {
      if (d.kind === 'dom-image') {
        expect(manager.isResourceLoaded(d.key)).toBe(true)
      }
    }
  })

  it('dispose mid-load fences publication the same way', async () => {
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
    const pending = manager.ensureLoaded(['core-ui'])

    manager.dispose()
    resolveLoad()

    await expect(pending).rejects.toThrow('superseded')
    expect(manager.isLoaded('core-ui')).toBe(false)
    await expect(manager.ensureLoaded(['core-ui'])).rejects.toThrow('disposed')
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


describe('W4 dom-audio lane', () => {
  let loaderScene: ReturnType<typeof createMockLoaderScene>
  let domImageLoader: DomImageLoader

  beforeEach(() => {
    loaderScene = createMockLoaderScene()
    domImageLoader = vi.fn(async () => undefined)
  })

  function injectCue(id: string, srcValue: string | readonly string[]) {
    const cues = AUDIO_CUES as Record<string, (typeof AUDIO_CUES)[string]>
    const orig = cues[id]
    cues[id] = { ...orig!, src: srcValue }
    return () => {
      if (orig) cues[id] = orig
      else delete cues[id]
    }
  }

  it('loads optional audio, hands encoded bytes to AudioManager, dedupes', async () => {
    const restore = injectCue('ui.click', 'assets/audio/ui/click.ogg')
    const attach = vi
      .spyOn(AudioManager.getInstance(), 'attachEncodedBuffer')
      .mockImplementation(() => undefined)
    const bytes = new ArrayBuffer(8)
    const domAudioLoader: DomAudioLoader = vi.fn(async () => bytes)
    try {
      const manager = new AssetBundleManager({ loaderScene, domImageLoader, domAudioLoader })
      await manager.ensureLoaded(['audio-core'])
      await manager.ensureLoaded(['audio-core'])
      expect(domAudioLoader).toHaveBeenCalledTimes(1)
      expect(attach).toHaveBeenCalledWith('assets/audio/ui/click.ogg', bytes)
      expect(manager.isResourceLoaded('assets/audio/ui/click.ogg')).toBe(true)
    } finally {
      attach.mockRestore()
      restore()
    }
  })

  it('a fetch failure marks the key missing and resolves (never rejects)', async () => {
    const restore = injectCue('combat.hit', 'assets/audio/sfx/missing.ogg')
    const domAudioLoader: DomAudioLoader = vi.fn(async () => {
      throw new Error('404')
    })
    try {
      const manager = new AssetBundleManager({ loaderScene, domImageLoader, domAudioLoader })
      await expect(manager.ensureLoaded(['audio-combat'])).resolves.toBeUndefined()
      expect(manager.isResourceLoaded('assets/audio/sfx/missing.ogg')).toBe(false)
      // bounded retry: second ensure re-fetches once (transient failures
      // must not silence a src forever), third+ resolves without fetching
      await manager.ensureLoaded(['audio-combat'])
      expect(domAudioLoader).toHaveBeenCalledTimes(2)
      await manager.ensureLoaded(['audio-combat'])
      expect(domAudioLoader).toHaveBeenCalledTimes(2)
    } finally {
      restore()
    }
  })

  it('two cues sharing one src dedupe to a single fetch keyed by src', async () => {
    const restore = injectCue('ui.click', 'shared.ogg')
    const restore2 = injectCue('ui.hover', 'shared.ogg')
    const attach = vi
      .spyOn(AudioManager.getInstance(), 'attachEncodedBuffer')
      .mockImplementation(() => undefined)
    const domAudioLoader: DomAudioLoader = vi.fn(async () => new ArrayBuffer(4))
    try {
      const manager = new AssetBundleManager({ loaderScene, domImageLoader, domAudioLoader })
      await manager.ensureLoaded(['audio-core'])
      expect(domAudioLoader).toHaveBeenCalledTimes(1)
      expect(attach).toHaveBeenCalledWith('shared.ogg', expect.any(ArrayBuffer))
    } finally {
      attach.mockRestore()
      restore()
      restore2()
    }
  })
})
