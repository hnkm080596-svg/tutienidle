import type Phaser from 'phaser'
import {
  getInkWashUiAsset,
  type InkWashUiAssetId,
} from '@/assets/inkWashUi'

export const INK_WASH_UI_ATLAS_KEY = 'ink-wash-ui'
export const INK_WASH_UI_ATLAS_IMAGE_URL = 'assets/ui/ink-wash/atlas/ink-wash-ui.png'
export const INK_WASH_UI_ATLAS_DATA_URL = 'assets/ui/ink-wash/atlas/ink-wash-ui.json'

export interface AddInkWashNineSliceOptions {
  id: InkWashUiAssetId
  x: number
  y: number
  width: number
  height: number
  origin?: number
  tint?: number
  alpha?: number
}

export function queueInkWashUiAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(INK_WASH_UI_ATLAS_KEY)) return
  scene.load.atlas(
    INK_WASH_UI_ATLAS_KEY,
    INK_WASH_UI_ATLAS_IMAGE_URL,
    INK_WASH_UI_ATLAS_DATA_URL,
  )
}

export function addInkWashNineSlice(
  scene: Phaser.Scene,
  options: AddInkWashNineSliceOptions,
): Phaser.GameObjects.NineSlice {
  const asset = getInkWashUiAsset(options.id)
  const shouldTile = asset.edgeMode === 'tile'
  const args: Parameters<Phaser.GameObjects.GameObjectFactory['nineslice']> = [
    options.x,
    options.y,
    INK_WASH_UI_ATLAS_KEY,
    asset.id,
    options.width,
    options.height,
    asset.slices.left,
    asset.slices.right,
    asset.slices.top,
    asset.slices.bottom,
  ]

  if (shouldTile) args.push(true, true)
  const slice = scene.add.nineslice(...args).setOrigin(options.origin ?? 0.5)

  if (options.tint !== undefined && asset.tintable) slice.setTint(options.tint)
  if (options.alpha !== undefined) slice.setAlpha(options.alpha)
  return slice
}
