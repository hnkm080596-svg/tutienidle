import Phaser from 'phaser'
import { readOptionalGate } from '@/presentation/gate/PresentationGate'
import type { AssetResourceDescriptor } from '@/presentation/assets/AssetBundleCatalog'
import { ASSET_LOADER_SCENE_KEY } from '@/presentation/PresentationContracts'

export { ASSET_LOADER_SCENE_KEY }

/**
 * AssetLoaderScene (AstraDoctrine Law A10, AGENTS.md P17).
 * Independent, persistent, non-visual Phaser scene for physical asset loading.
 *
 * Invariant:
 * - No display objects.
 * - No domain access.
 * - No automatic next-scene navigation.
 * - Verifies texture cache after loading completes; COMPLETE alone is not proof of success.
 */
export class AssetLoaderScene extends Phaser.Scene {
  private activeLoadPromise: Promise<void> | null = null

  constructor() {
    super(ASSET_LOADER_SCENE_KEY)
  }

  /**
   * Self-registration is the ONLY reliable moment: Phaser boots its scenes
   * asynchronously, so the host cannot fetch this instance straight after
   * `new Phaser.Game()` - it is not constructed yet, and the asset phase would
   * wait for a loader that never arrives.
   */
  create(): void {
    const bundleManager = readOptionalGate(this.registry, 'bundleManager')

    bundleManager?.setLoaderScene(this)
  }

  isTextureLoaded(key: string): boolean {
    return this.textures ? this.textures.exists(key) : false
  }

  /**
   * Batches are serialized: one Phaser LoaderPlugin is shared by every caller,
   * so two overlapping batches would both call load.start() and each would
   * settle on the FIRST COMPLETE event - the later batch would then "verify"
   * textures its own files had not loaded yet and reject spuriously.
   */
  loadDescriptors(
    descriptors: readonly AssetResourceDescriptor[],
    signal?: AbortSignal,
  ): Promise<void> {
    const runBatch = () => this.runLoadBatch(descriptors, signal)

    // Chain onto the previous batch however it settled - a failed batch must
    // not stall the queue.
    const queued = this.activeLoadPromise
      ? this.activeLoadPromise.then(runBatch, runBatch)
      : runBatch()

    const settled = queued.catch(() => {})
    this.activeLoadPromise = settled

    // Let the last batch clear the chain so an idle loader holds nothing.
    void settled.then(() => {
      if (this.activeLoadPromise === settled) {
        this.activeLoadPromise = null
      }
    })

    return queued
  }

  private async runLoadBatch(
    descriptors: readonly AssetResourceDescriptor[],
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted) {
      throw new Error('Load aborted')
    }

    // Filter to Phaser-loadable descriptors (exclude dom-image which is loaded in DOM)
    const phaserDescriptors = descriptors.filter(
      (d): d is Exclude<AssetResourceDescriptor, { kind: 'dom-image' }> => d.kind !== 'dom-image',
    )

    // Filter out already-loaded textures
    const needed = phaserDescriptors.filter((d) => !this.isTextureLoaded(d.key))

    if (needed.length === 0) {
      return
    }

    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Load aborted'))
        return
      }

      const failedKeys = new Set<string>()

      const onError = (file: { key?: string }) => {
        if (file?.key) {
          failedKeys.add(file.key)
        }
      }

      const onAbort = () => {
        cleanup()
        reject(new Error('Load aborted'))
      }

      const onComplete = () => {
        cleanup()

        // Check if any file failed during load
        if (failedKeys.size > 0) {
          reject(new Error(`Failed to load assets: ${Array.from(failedKeys).join(', ')}`))
          return
        }

        // Verify texture cache existence after complete
        const missing = needed.filter((d) => !this.isTextureLoaded(d.key))
        if (missing.length > 0) {
          reject(
            new Error(
              `Textures missing from cache after complete: ${missing.map((d) => d.key).join(', ')}`,
            ),
          )
          return
        }

        resolve()
      }

      const cleanup = () => {
        this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError)
        this.load.off(Phaser.Loader.Events.COMPLETE, onComplete)
        signal?.removeEventListener('abort', onAbort)
      }

      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError)
      this.load.once(Phaser.Loader.Events.COMPLETE, onComplete)
      signal?.addEventListener('abort', onAbort)

      for (const d of needed) {
        switch (d.kind) {
          case 'image':
            this.load.image(d.key, d.url)
            break
          case 'spritesheet':
            this.load.spritesheet(d.key, d.url, {
              frameWidth: d.frameWidth,
              frameHeight: d.frameHeight,
            })
            break
          case 'atlas':
            this.load.atlas(d.key, d.textureUrl, d.atlasUrl)
            break
          case 'multiatlas':
            this.load.multiatlas(d.key, d.jsonUrl, d.basePath)
            break
        }
      }

      this.load.start()
    })
  }
}
