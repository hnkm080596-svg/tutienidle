// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import Phaser from 'phaser'
import { AssetLoaderScene } from './AssetLoaderScene'
import type { AssetResourceDescriptor } from '@/presentation/assets/AssetBundleCatalog'

type LoaderHandler = (file?: { key?: string }) => void

/**
 * Stands in for Phaser's shared LoaderPlugin: one queue, one COMPLETE event
 * per start(), exactly like the real plugin every batch has to share.
 */
function createFakeLoader() {
  const handlers = new Map<string, Set<LoaderHandler>>()
  const queued: string[] = []
  let startCount = 0

  return {
    startCount: () => startCount,
    queuedKeys: () => [...queued],
    on(event: string, handler: LoaderHandler) {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(handler)
    },
    once(event: string, handler: LoaderHandler) {
      this.on(event, handler)
    },
    off(event: string, handler: LoaderHandler) {
      handlers.get(event)?.delete(handler)
    },
    image(key: string) {
      queued.push(key)
    },
    spritesheet(key: string) {
      queued.push(key)
    },
    atlas(key: string) {
      queued.push(key)
    },
    multiatlas(key: string) {
      queued.push(key)
    },
    start() {
      startCount += 1
    },
    emitComplete() {
      for (const handler of [...(handlers.get(Phaser.Loader.Events.COMPLETE) ?? [])]) {
        handler()
      }
    },
    emitFileError(key: string) {
      for (const handler of [...(handlers.get(Phaser.Loader.Events.FILE_LOAD_ERROR) ?? [])]) {
        handler({ key })
      }
    },
  }
}

function createScene() {
  const scene = new AssetLoaderScene()
  const loader = createFakeLoader()
  const existing = new Set<string>()

  Object.defineProperty(scene, 'load', { value: loader, writable: true })
  Object.defineProperty(scene, 'textures', {
    value: { exists: (key: string) => existing.has(key) },
    writable: true,
  })

  return { scene, loader, existing }
}

function image(key: string): AssetResourceDescriptor {
  return { kind: 'image', key, url: `assets/${key}.png` }
}

async function flush(times = 6) {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

describe('AssetLoaderScene', () => {
  it('serializes overlapping batches so a later batch never settles on an earlier COMPLETE', async () => {
    const { scene, loader, existing } = createScene()

    const first = scene.loadDescriptors([image('a')])
    await flush()

    // Second batch arrives while the first is still in flight.
    const second = scene.loadDescriptors([image('b')])
    await flush()

    expect(loader.startCount()).toBe(1)
    expect(loader.queuedKeys()).toEqual(['a'])

    existing.add('a')
    loader.emitComplete()
    await expect(first).resolves.toBeUndefined()
    await flush()

    // Only now does the second batch queue and start its own files.
    expect(loader.startCount()).toBe(2)
    expect(loader.queuedKeys()).toEqual(['a', 'b'])

    existing.add('b')
    loader.emitComplete()
    await expect(second).resolves.toBeUndefined()
  })

  it('runs the next batch even after the previous one rejects', async () => {
    const { scene, loader, existing } = createScene()

    const failing = scene.loadDescriptors([image('bad')])
    await flush()

    const following = scene.loadDescriptors([image('good')])
    await flush()

    loader.emitFileError('bad')
    loader.emitComplete()
    await expect(failing).rejects.toThrow(/bad/)
    await flush()

    expect(loader.startCount()).toBe(2)

    existing.add('good')
    loader.emitComplete()
    await expect(following).resolves.toBeUndefined()
  })

  it('rejects when a required texture is absent from the cache after COMPLETE', async () => {
    const { scene, loader } = createScene()

    const pending = scene.loadDescriptors([image('never-arrives')])
    await flush()

    loader.emitComplete()

    await expect(pending).rejects.toThrow(/never-arrives/)
  })

  it('resolves without waiting for an event when nothing needs loading', async () => {
    const { scene, loader, existing } = createScene()
    existing.add('cached')

    await expect(scene.loadDescriptors([image('cached')])).resolves.toBeUndefined()
    expect(loader.startCount()).toBe(0)
  })

  it('ignores dom-image descriptors: those are decoded outside Phaser', async () => {
    const { scene, loader } = createScene()

    await expect(
      scene.loadDescriptors([{ kind: 'dom-image', key: 'layer', url: 'assets/layer.png' }]),
    ).resolves.toBeUndefined()
    expect(loader.startCount()).toBe(0)
  })

})
