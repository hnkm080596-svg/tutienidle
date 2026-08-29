import { describe, expect, it } from 'vitest'
import {
  INK_WASH_UI_ASSET_IDS,
  INK_WASH_UI_ASSETS,
  getInkWashUiAsset,
} from './inkWashUi'

const EXPECTED_IDS = [
  'frame-xs-ink-line',
  'button-s-paper',
  'button-s-ink',
  'button-s-seal',
  'frame-s-slot',
  'surface-m-paper',
  'frame-m-seal-corner',
  'surface-l-ink-data',
  'frame-l-landscape',
  'surface-xl-paper-scroll',
  'frame-xl-ceremony',
] as const

describe('ink-wash UI manifest', () => {
  it('contains the exact approved XS-to-XL asset set', () => {
    expect(INK_WASH_UI_ASSET_IDS).toEqual(EXPECTED_IDS)
    expect(Object.keys(INK_WASH_UI_ASSETS)).toEqual(EXPECTED_IDS)
  })

  it('keeps every slice inside its source and derives minimum size', () => {
    for (const asset of Object.values(INK_WASH_UI_ASSETS)) {
      expect(asset.slices.left + asset.slices.right).toBeLessThanOrEqual(asset.sourceWidth)
      expect(asset.slices.top + asset.slices.bottom).toBeLessThanOrEqual(asset.sourceHeight)
      expect(asset.minimumWidth).toBe(asset.slices.left + asset.slices.right)
      expect(asset.minimumHeight).toBe(asset.slices.top + asset.slices.bottom)
      expect(asset.url1x).toBe(`/assets/ui/ink-wash/slices/${asset.id}@1x.png`)
      expect(asset.url2x).toBe(`/assets/ui/ink-wash/slices/${asset.id}@2x.png`)
    }
  })

  it('returns the same canonical object by ID', () => {
    expect(getInkWashUiAsset('frame-xl-ceremony')).toBe(
      INK_WASH_UI_ASSETS['frame-xl-ceremony'],
    )
  })
})
