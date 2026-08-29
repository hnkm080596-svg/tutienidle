import rawManifest from './ink-wash-ui-slices.json'

export const INK_WASH_UI_ASSET_IDS = [
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

export type InkWashUiAssetId = (typeof INK_WASH_UI_ASSET_IDS)[number]
export type InkWashUiCenterMode = 'transparent' | 'fill'
export type InkWashUiEdgeMode = 'stretch' | 'tile'

export interface InkWashUiAsset {
  id: InkWashUiAssetId
  url1x: string
  url2x: string
  sourceWidth: number
  sourceHeight: number
  slices: {
    left: number
    right: number
    top: number
    bottom: number
  }
  center: InkWashUiCenterMode
  edgeMode: InkWashUiEdgeMode
  tintable: boolean
  minimumWidth: number
  minimumHeight: number
}

// JSON là nguồn dữ liệu duy nhất; assertion được cô lập tại biên nhập
// tĩnh và được bảo vệ bởi test contract + validator raster ở pipeline.
const assets = rawManifest.assets as InkWashUiAsset[]

export const INK_WASH_UI_ASSETS = Object.fromEntries(
  assets.map((asset) => [asset.id, Object.freeze(asset)]),
) as Readonly<Record<InkWashUiAssetId, Readonly<InkWashUiAsset>>>

export function getInkWashUiAsset(id: InkWashUiAssetId): Readonly<InkWashUiAsset> {
  return INK_WASH_UI_ASSETS[id]
}
