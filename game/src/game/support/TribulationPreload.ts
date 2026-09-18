// TribulationPreload — the transitional preload net for TribulationScene,
// fed by the SAME 'tribulation' bundle descriptors AssetLoaderScene loads
// (A10: one canonical catalog). The scene queues no literal URLs of its
// own: a new tribulation asset lands here by landing in the catalog first.
import type Phaser from 'phaser'
import { getTribulationDescriptors } from '@/presentation/assets/AssetBundleCatalog'
import { INK_WASH_UI_ATLAS_KEY } from '@/game/support/InkWashUiPhaser'

/**
 * Queue the mode-appropriate tribulation assets. The ink-wash atlas is
 * skipped: the scene still queues it through queueInkWashUiAtlas(), the
 * dedicated helper its own tests pin, and queuing the same key twice in
 * one preload would double the loader entry.
 */
export function queueTribulationAssets(scene: Phaser.Scene): void {
  const queuedKeys = new Set<string>()

  for (const d of getTribulationDescriptors()) {
    if (d.kind === 'dom-image' || d.key === INK_WASH_UI_ATLAS_KEY) {
      continue
    }

    if (queuedKeys.has(d.key) || scene.textures.exists(d.key)) {
      continue
    }

    queuedKeys.add(d.key)

    switch (d.kind) {
      case 'image':
        scene.load.image(d.key, d.url)
        break
      case 'spritesheet':
        scene.load.spritesheet(d.key, d.url, {
          frameWidth: d.frameWidth,
          frameHeight: d.frameHeight,
        })
        break
      case 'atlas':
        scene.load.atlas(d.key, d.textureUrl, d.atlasUrl)
        break
      case 'multiatlas':
        scene.load.multiatlas(d.key, d.jsonUrl, d.basePath)
        break
    }
  }
}
