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
import { resolveAssetUrl } from './AssetBaseUrl'
import {
  enumerateResources,
  getBundleDescriptors,
  getBundlesForRoute,
  type AssetBundleId,
  type AssetResourceDescriptor,
  type DomAudioResourceDescriptor,
  type DomImageResourceDescriptor,
} from './AssetBundleCatalog'
import type { AssetLoaderScene } from '@/game/scenes/AssetLoaderScene'
import { AudioManager } from '@/core/audio/AudioManager'

// Fetch attempts per dom-audio src before the missing-mark sticks for the
// session - one transient network failure must not permanently silence a
// cue; two failed fetches is enough evidence the file is absent.
const DOM_AUDIO_FETCH_ATTEMPTS = 2

export type DomImageLoader = (url: string, signal?: AbortSignal) => Promise<void>

/**
 * Sound System W4: fetches the first reachable URL of an audio descriptor
 * and returns the raw bytes; AudioManager owns decoding (the context owns
 * decodeAudioData, not this DOM lane).
 */
export type DomAudioLoader = (
  urls: readonly string[],
  signal?: AbortSignal,
) => Promise<ArrayBuffer>

export function defaultDomAudioLoader(
  urls: readonly string[],
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  return (async () => {
    if (typeof fetch !== 'function') {
      throw new Error('fetch unavailable in this environment')
    }
    let lastError: unknown = new Error('no audio urls')
    for (const url of urls) {
      if (signal?.aborted) throw new Error(`Load aborted: ${url}`)
      try {
        const res = await fetch(resolveAssetUrl(url), { signal })
        if (!res.ok) throw new Error(`Audio fetch failed ${res.status}: ${url}`)
        return await res.arrayBuffer()
      } catch (err) {
        lastError = err
      }
    }
    throw lastError
  })()
}

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
  if (a.kind === 'dom-audio' && b.kind === 'dom-audio') {
    return a.urls.length === b.urls.length && a.urls.every((url, i) => url === b.urls[i])
  }
  return false
}

export interface AssetBundleManagerOptions {
  loaderScene?: AssetLoaderScene | null
  domImageLoader?: DomImageLoader
  domAudioLoader?: DomAudioLoader
}

export class AssetBundleManager implements AssetPort {
  private loaderScene: AssetLoaderScene | null = null
  private readonly domImageLoader: DomImageLoader
  private readonly domAudioLoader: DomAudioLoader

  private readonly knownDescriptors = new Map<string, AssetResourceDescriptor>()
  private readonly loadedResources = new Set<string>()
  // Optional (dom-audio) resources: failed fetch count per key. One
  // transient failure must not silence an src forever - a later request
  // gets one more try; past DOM_AUDIO_FETCH_ATTEMPTS the key resolves
  // immediately without re-fetching a known-missing file.
  private readonly missingResources = new Map<string, number>()
  private readonly inFlightLoads = new Map<string, Promise<void>>()
  /** DOM-lane keys inside loadedResources - they survive loader-scene swaps
   *  (browser cache / AudioManager bytes are scene-independent). */
  private readonly domLoadedKeys = new Set<string>()
  // DOM image/audio loads are scene-independent (browser cache /
  // AudioManager): dedupe them in a map a loader swap does NOT clear,
  // otherwise a mid-flight fetch becomes unjoinable and a second
  // ensureLoaded duplicates it.
  private readonly domInFlightLoads = new Map<string, Promise<void>>()
  private readonly loaderSceneResolvers = new Set<{
    resolve: (scene: AssetLoaderScene) => void
    reject: (err: Error) => void
    onAbort: () => void
  }>()
  private disposed = false
  // ARCH-013/L04 - loadedResources records what the CURRENT loader's cache
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
    this.domAudioLoader = options.domAudioLoader ?? defaultDomAudioLoader
  }

  setLoaderScene(scene: AssetLoaderScene | null): void {
    // A scene arriving after disposal must not re-arm the load pipeline.
    if (this.disposed) return
    if (this.loaderScene !== scene) {
      // Scene changed or game recreated: clear cache bound to previous scene.
      // The generation bump is what stops a still-running old-generation load
      // from re-publishing its result into the fresh cache when it resolves.
      this.loaderScene = scene
      this.loaderGeneration += 1
      // Only scene-bound records die with the loader swap: DOM-lane keys
      // (browser image cache / decoded AudioManager bytes) outlive any
      // loader scene, so they stay loaded across the swap.
      for (const key of [...this.loadedResources]) {
        if (!this.domLoadedKeys.has(key)) this.loadedResources.delete(key)
      }
      // DOM lanes keep their own in-flight map (domInFlightLoads): a DOM
      // fetch's result lives in the browser/AudioManager caches, which are
      // scene-independent, so a loader swap must not detach it into an
      // unjoinable duplicate fetch the way it should for scene-bound loads.
      this.inFlightLoads.clear()

      if (scene) {
        for (const entry of this.loaderSceneResolvers) {
          entry.resolve(scene)
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

    // Split between DOM images, DOM audio, and Phaser textures
    const domDescriptors = needed.filter(
      (d): d is DomImageResourceDescriptor => d.kind === 'dom-image',
    )
    const domAudioDescriptors = needed.filter(
      (d): d is DomAudioResourceDescriptor => d.kind === 'dom-audio',
    )
    const phaserDescriptors = needed.filter(
      (d) => d.kind !== 'dom-image' && d.kind !== 'dom-audio',
    )

    const tasks: Promise<void>[] = []

    // 1. Load DOM images (each deduped per key)
    for (const domDesc of domDescriptors) {
      tasks.push(this.loadSingleDomImage(domDesc, signal))
    }

    // 1b. Load DOM audio (deduped per key; fail-soft per the optional contract)
    for (const audioDesc of domAudioDescriptors) {
      tasks.push(this.loadSingleDomAudio(audioDesc, signal))
    }

    // 2. Load Phaser textures via loader scene (serialized batch)
    if (phaserDescriptors.length > 0) {
      let loader = this.loaderScene ?? (await this.waitForLoaderScene(signal))
      // A waiter resolved with scene A can be superseded by a same-tick
      // setLoaderScene(B) before the continuation runs - re-wait until
      // the captured loader is current, else a stale scene publishes
      // keys into the new generation's resource map.
      while (loader !== this.loaderScene) {
        loader = this.loaderScene ?? (await this.waitForLoaderScene(signal))
      }
      tasks.push(this.loadPhaserBatch(loader, phaserDescriptors, signal))
    }

    await Promise.all(tasks)
  }

  private waitForLoaderScene(signal?: AbortSignal): Promise<AssetLoaderScene> {
    // Registered waiters can never settle once the manager is disposed or the
    // caller's signal already fired - registering either way would dangle.
    if (this.disposed) return Promise.reject(new Error('AssetBundleManager disposed'))
    if (signal?.aborted) return Promise.reject(new Error('Load aborted'))
    if (this.loaderScene) return Promise.resolve(this.loaderScene)

    return new Promise<AssetLoaderScene>((resolve, reject) => {
      const entry = {
        resolve: (scene: AssetLoaderScene) => {
          signal?.removeEventListener('abort', entry.onAbort)
          resolve(scene)
        },
        reject: (err: Error) => {
          signal?.removeEventListener('abort', entry.onAbort)
          reject(err)
        },
        onAbort: () => {
          this.loaderSceneResolvers.delete(entry)
          reject(new Error('Load aborted'))
        },
      }

      signal?.addEventListener('abort', entry.onAbort, { once: true })
      this.loaderSceneResolvers.add(entry)
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
    // Reject outstanding waiters - silently clearing them would leave a
    // caller awaiting a scene that can never arrive (dangling promise).
    for (const entry of this.loaderSceneResolvers) {
      entry.reject(new Error('AssetBundleManager disposed'))
    }
    this.loaderSceneResolvers.clear()
    this.inFlightLoads.clear()
    this.domInFlightLoads.clear()
    this.loadedResources.clear()
    this.domLoadedKeys.clear()
    this.missingResources.clear()
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

    const existingPromise = this.domInFlightLoads.get(desc.key)
    if (existingPromise) {
      return this.wrapWithSignal(existingPromise, signal)
    }

    const runLoad = async (): Promise<void> => {
      try {
        await this.domImageLoader(resolveAssetUrl(desc.url))
        // No loaderGeneration fence here: a DOM image's result lives in the
        // browser cache, not in the loader scene's texture cache, so a
        // setLoaderScene/dispose during the await cannot make it stale. The
        // record stays true no matter which Phaser.Game is current - fencing
        // it would turn every first-entry host registration into a spurious
        // "superseded" failure mid-transition.
        if (!this.disposed) {
          this.loadedResources.add(desc.key)
          this.domLoadedKeys.add(desc.key)
        }
      } finally {
        // Identity-guarded delete: a NEW load may already have registered
        // its own entry for this key - a stale continuation must not
        // remove it.
        if (this.domInFlightLoads.get(desc.key) === loadPromise) {
          this.domInFlightLoads.delete(desc.key)
        }
      }
    }

    const loadPromise = runLoad()

    this.domInFlightLoads.set(desc.key, loadPromise)
    return this.wrapWithSignal(loadPromise, signal)
  }

  /**
   * Optional lane (Sound System W4): identical dedupe/inFlight mechanics as
   * loadSingleDomImage, but a load failure marks the key missing and
   * RESOLVES - audio must never reject a route the way a missing texture
   * does. Decoded bytes hand to AudioManager's decode cache.
   */
  private loadSingleDomAudio(
    desc: DomAudioResourceDescriptor,
    signal?: AbortSignal,
  ): Promise<void> {
    const tries = this.missingResources.get(desc.key) ?? 0
    if (this.isResourceLoaded(desc.key) || tries >= DOM_AUDIO_FETCH_ATTEMPTS) {
      return Promise.resolve()
    }

    const existingPromise = this.domInFlightLoads.get(desc.key)
    if (existingPromise) {
      return this.wrapWithSignal(existingPromise, signal).catch(() => undefined)
    }

    const runLoad = async (): Promise<void> => {
      try {
        // The loader promise is deduped across callers via domInFlightLoads,
        // so it must not carry any one caller's abort signal - aborting
        // caller A would kill the shared fetch for every joiner whose
        // wrapWithSignal then resolves success on a load that never ran.
        // Per-caller abort still applies at the wrapWithSignal layer.
        const bytes = await this.domAudioLoader(desc.urls)
        // A detached continuation (post-dispose manager) must not park
        // bytes into a live AudioManager singleton it no longer owns.
        if (!this.disposed) {
          AudioManager.getInstance().attachEncodedBuffer(desc.key, bytes)
          this.loadedResources.add(desc.key)
          this.domLoadedKeys.add(desc.key)
        }
      } catch {
        // A post-dispose rejection is teardown fallout, not a fetch
        // failure - it must not spend a fetch attempt.
        if (this.disposed) return
        // The deduped loader never carries a caller's signal, so every
        // rejection here is a real fetch/decode failure and counts against
        // the attempt bound. Read-modify-write against the current count:
        // the shared map survives a loader swap, so a second load for the
        // same key can still overlap the first - both closures would hold
        // the same stale `tries` and under-count the rejections.
        this.missingResources.set(
          desc.key,
          Math.max(this.missingResources.get(desc.key) ?? 0, tries) + 1,
        )
      } finally {
        if (this.domInFlightLoads.get(desc.key) === loadPromise) {
          this.domInFlightLoads.delete(desc.key)
        }
      }
    }

    const loadPromise = runLoad()

    this.domInFlightLoads.set(desc.key, loadPromise)
    // The promise itself never rejects (fail-soft), but wrapWithSignal can
    // reject on caller abort - callers of an OPTIONAL lane must not see a
    // rejection either, so swallow it.
    return this.wrapWithSignal(loadPromise, signal).catch(() => undefined)
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

    // Reached after an await boundary - the waitForLoaderScene in
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
        // into the OLD scene's texture cache - the new loader does not hold
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
