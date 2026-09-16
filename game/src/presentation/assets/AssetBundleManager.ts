/**
 * AssetBundleManager (AstraDoctrine Law A10, AGENTS.md P17).
 * Central asset loading coordinator.
 *
 * Invariant:
 * - Deduplicates physical resource requests.
 * - Descriptors collision detection rejects conflicting definitions for same key.
 * - Supports concurrent ensure and prefetch without duplicate loads.
 * - Cancellation of one subscriber does not abort shared loads for another.
 * - Verifies resource cache existence after load; COMPLETE alone is not proof of success.
 * - Manages both Phaser textures and DOM image decode.
 */

import type { AssetPort, RouteRequest } from '../PresentationContracts'
import {
  enumerateResources,
  getBundleDescriptors,
  getBundlesForRoute,
  type AssetBundleId,
  type AssetResourceDescriptor,
  type DomImageResourceDescriptor,
} from './AssetBundleCatalog'
import type { AssetLoaderScene } from '@/game/scenes/AssetLoaderScene'

export type DomImageLoader = (url: string, signal?: AbortSignal) => Promise<void>

export function defaultDomImageLoader(url: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(`Load aborted: ${url}`))
      return
    }

    const image = new Image()

    const onAbort = () => {
      image.onload = null
      image.onerror = null
      reject(new Error(`Load aborted: ${url}`))
    }

    image.onload = () => {
      signal?.removeEventListener('abort', onAbort)
      if (typeof image.decode === 'function') {
        image
          .decode()
          .then(() => resolve())
          .catch(() => resolve()) // decode error after load resolves anyway
      } else {
        resolve()
      }
    }

    image.onerror = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new Error(`Unable to load DOM image: ${url}`))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    image.src = url
  })
}

export function descriptorsMatch(a: AssetResourceDescriptor, b: AssetResourceDescriptor): boolean {
  if (a.kind !== b.kind || a.key !== b.key) return false
  if (a.kind === 'image' && b.kind === 'image') return a.url === b.url
  if (a.kind === 'dom-image' && b.kind === 'dom-image') return a.url === b.url
  if (a.kind === 'spritesheet' && b.kind === 'spritesheet') {
    return a.url === b.url && a.frameWidth === b.frameWidth && a.frameHeight === b.frameHeight
  }
  if (a.kind === 'atlas' && b.kind === 'atlas') {
    return a.textureUrl === b.textureUrl && a.atlasUrl === b.atlasUrl
  }
  if (a.kind === 'multiatlas' && b.kind === 'multiatlas') {
    return a.jsonUrl === b.jsonUrl && a.basePath === b.basePath
  }
  return false
}

export interface AssetBundleManagerOptions {
  loaderScene?: AssetLoaderScene | null
  domImageLoader?: DomImageLoader
}

export class AssetBundleManager implements AssetPort {
  private loaderScene: AssetLoaderScene | null = null
  private readonly domImageLoader: DomImageLoader

  private readonly knownDescriptors = new Map<string, AssetResourceDescriptor>()
  private readonly loadedResources = new Set<string>()
  private readonly inFlightLoads = new Map<string, Promise<void>>()
  private readonly loaderSceneResolvers = new Set<(scene: AssetLoaderScene) => void>()
  private disposed = false
  // ARCH-013/L04 — loadedResources records what the CURRENT loader's cache
  // holds. setLoaderScene/dispose bump this; a physical load that resolves
  // afterward must not publish into a cache it was cleared out of (the old
  // continuation would resurrect keys the swap deliberately dropped while
  // the new Phaser.Game's texture manager does not actually hold them).
  // The fence guards the Phaser batch only - DOM images live in the browser
  // cache, which a loader swap cannot make stale.
  private loaderGeneration = 0

  constructor(options: AssetBundleManagerOptions = {}) {
    this.loaderScene = options.loaderScene ?? null
    this.domImageLoader = options.domImageLoader ?? defaultDomImageLoader
  }

  setLoaderScene(scene: AssetLoaderScene | null): void {
    if (this.loaderScene !== scene) {
      // Scene changed or game recreated: clear cache bound to previous scene.
      // The generation bump is what stops a still-running old-generation load
      // from re-publishing its result into the fresh cache when it resolves.
      this.loaderScene = scene
      this.loaderGeneration += 1
      this.loadedResources.clear()
      this.inFlightLoads.clear()

      if (scene) {
        for (const resolver of this.loaderSceneResolvers) {
          resolver(scene)
        }
        this.loaderSceneResolvers.clear()
      }
    }
  }

  isResourceLoaded(key: string): boolean {
    if (this.loadedResources.has(key)) return true
    if (this.loaderScene?.isTextureLoaded(key)) {
      this.loadedResources.add(key)
      return true
    }
    return false
  }

  isLoaded(bundleId: AssetBundleId): boolean {
    const descriptors = getBundleDescriptors(bundleId)
    return descriptors.every((d) => this.isResourceLoaded(d.key))
  }

  async ensureFor(request: RouteRequest, signal: AbortSignal): Promise<void> {
    await this.ensureLoaded(getBundlesForRoute(request.target), signal)
  }

  async ensureLoaded(
    bundleIds: readonly AssetBundleId[],
    signal?: AbortSignal,
  ): Promise<void> {
    if (this.disposed) {
      throw new Error('AssetBundleManager disposed')
    }
    if (signal?.aborted) {
      throw new Error('Load aborted')
    }

    const descriptors = enumerateResources(bundleIds)
    this.validateDescriptorCollisions(descriptors)

    const needed = descriptors.filter((d) => !this.isResourceLoaded(d.key))
    if (needed.length === 0) {
      return
    }

    // Split between DOM images and Phaser textures
    const domDescriptors = needed.filter(
      (d): d is DomImageResourceDescriptor => d.kind === 'dom-image',
    )
    const phaserDescriptors = needed.filter((d) => d.kind !== 'dom-image')

    const tasks: Promise<void>[] = []

    // 1. Load DOM images (each deduped per key)
    for (const domDesc of domDescriptors) {
      tasks.push(this.loadSingleDomImage(domDesc, signal))
    }

    // 2. Load Phaser textures via loader scene (serialized batch)
    if (phaserDescriptors.length > 0) {
      const loader = this.loaderScene ?? (await this.waitForLoaderScene(signal))
      tasks.push(this.loadPhaserBatch(loader, phaserDescriptors, signal))
    }

    await Promise.all(tasks)
  }

  private waitForLoaderScene(signal?: AbortSignal): Promise<AssetLoaderScene> {
    if (this.loaderScene) return Promise.resolve(this.loaderScene)

    return new Promise<AssetLoaderScene>((resolve, reject) => {
      const onAbort = () => {
        this.loaderSceneResolvers.delete(resolver)
        reject(new Error('Load aborted'))
      }

      const resolver = (scene: AssetLoaderScene) => {
        signal?.removeEventListener('abort', onAbort)
        resolve(scene)
      }

      signal?.addEventListener('abort', onAbort, { once: true })
      this.loaderSceneResolvers.add(resolver)
    })
  }

  async prefetch(bundleIds: readonly AssetBundleId[]): Promise<void> {
    if (this.disposed) return
    try {
      await this.ensureLoaded(bundleIds)
    } catch {
      // Prefetch failures are non-fatal; logged but do not reject
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.loaderScene = null
    this.loaderGeneration += 1
    this.loaderSceneResolvers.clear()
    this.inFlightLoads.clear()
    this.loadedResources.clear()
    this.knownDescriptors.clear()
  }

  private validateDescriptorCollisions(descriptors: readonly AssetResourceDescriptor[]): void {
    for (const d of descriptors) {
      const existing = this.knownDescriptors.get(d.key)
      if (existing) {
        if (!descriptorsMatch(existing, d)) {
          throw new Error(
            `Asset descriptor collision for key "${d.key}": conflicting configurations detected`,
          )
        }
      } else {
        this.knownDescriptors.set(d.key, d)
      }
    }
  }

  private loadSingleDomImage(
    desc: DomImageResourceDescriptor,
    signal?: AbortSignal,
  ): Promise<void> {
    if (this.isResourceLoaded(desc.key)) {
      return Promise.resolve()
    }

    const existingPromise = this.inFlightLoads.get(desc.key)
    if (existingPromise) {
      return this.wrapWithSignal(existingPromise, signal)
    }

    const runLoad = async (): Promise<void> => {
      try {
        await this.domImageLoader(desc.url)
        // No loaderGeneration fence here: a DOM image's result lives in the
        // browser cache, not in the loader scene's texture cache, so a
        // setLoaderScene/dispose during the await cannot make it stale. The
        // record stays true no matter which Phaser.Game is current - fencing
        // it would turn every first-entry host registration into a spurious
        // "superseded" failure mid-transition.
        this.loadedResources.add(desc.key)
      } finally {
        // Identity-guarded delete: a loader swap clears the map, and a NEW
        // generation may already have registered its own entry for this key
        // — a stale continuation must not remove it.
        if (this.inFlightLoads.get(desc.key) === loadPromise) {
          this.inFlightLoads.delete(desc.key)
        }
      }
    }

    const loadPromise = runLoad()

    this.inFlightLoads.set(desc.key, loadPromise)
    return this.wrapWithSignal(loadPromise, signal)
  }

  private loadPhaserBatch(
    loader: AssetLoaderScene,
    descriptors: readonly AssetResourceDescriptor[],
    signal?: AbortSignal,
  ): Promise<void> {
    const uncommitted = descriptors.filter((d) => !this.isResourceLoaded(d.key))
    if (uncommitted.length === 0) {
      return Promise.resolve()
    }

    // Reached after an await boundary — the waitForLoaderScene in
    // ensureLoaded may have resolved while the caller's signal aborted.
    // Checking before the batch starts keeps an already-dead transition
    // from spending a fresh physical load on the new loader (its
    // wrapWithSignal would still reject, but only after the work ran).
    if (signal?.aborted) {
      return Promise.reject(new Error('Load aborted'))
    }

    const batchKey = uncommitted.map((d) => d.key).sort().join(',')
    const existing = this.inFlightLoads.get(batchKey)
    if (existing) {
      return this.wrapWithSignal(existing, signal)
    }

    const generation = this.loaderGeneration

    const runBatch = async (): Promise<void> => {
      try {
        await loader.loadDescriptors(uncommitted)
        // Generation fence (unlike the DOM path): these keys were written
        // into the OLD scene's texture cache — the new loader does not hold
        // them, so they must not be published (or claimed as success).
        if (generation !== this.loaderGeneration) {
          throw new Error('Asset load superseded by loader swap')
        }
        for (const d of uncommitted) {
          if (loader.isTextureLoaded(d.key)) {
            this.loadedResources.add(d.key)
          }
        }
      } finally {
        if (this.inFlightLoads.get(batchKey) === batchPromise) {
          this.inFlightLoads.delete(batchKey)
        }
      }
    }

    const batchPromise = runBatch()

    this.inFlightLoads.set(batchKey, batchPromise)
    return this.wrapWithSignal(batchPromise, signal)
  }

  private async wrapWithSignal(
    promise: Promise<void>,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!signal) return promise
    if (signal.aborted) throw new Error('Load aborted')

    let onAbort: (() => void) | undefined
    const abortPromise = new Promise<never>((_, reject) => {
      onAbort = () => reject(new Error('Load aborted'))
      signal.addEventListener('abort', onAbort, { once: true })
    })

    try {
      await Promise.race([promise, abortPromise])
    } finally {
      if (onAbort) {
        signal.removeEventListener('abort', onAbort)
      }
    }
  }
}
