import type { ThanhVanVariant } from './BackgroundVariant'

// Canonical layer map per spec SS14.4: L0 sky, L1 high/far ambience,
// L2 mid landscape + foreground occluder, L3 sect ground/buildings,
// L5 atmospheric FX. L4 (player) and L8 (screen-space UI) are owned by
// DongFuStage.vue / GameRoot.vue and are not image layers.
const TIME_LAYERS = [
  { file: '00-sky', shiftX: 0, shiftY: 0, motion: 'static', canonical: 'L0' },
  { file: '01-high-clouds', shiftX: 1, shiftY: 1, motion: 'cloud-slow', canonical: 'L1' },
  { file: '02-light-veil', shiftX: 2, shiftY: 1, motion: 'cloud-medium', canonical: 'L1' },
] as const

const SEASON_LAYERS: readonly {
  file: string
  shiftX: number
  shiftY: number
  motion: 'static' | 'mist-slow'
  canonical: 'L1' | 'L2' | 'L3' | 'L5'
  fxPending?: 'waterfall-shimmer' | 'water-shimmer'
}[] = [
  { file: '03-far-mountains', shiftX: 4, shiftY: 2, motion: 'static', canonical: 'L1' },
  { file: '04-distant-ledges', shiftX: 6, shiftY: 3, motion: 'static', canonical: 'L2' },
  {
    file: '05-mid-landscape',
    shiftX: 8,
    shiftY: 4,
    motion: 'static',
    canonical: 'L2',
    fxPending: 'waterfall-shimmer',
  },
  {
    file: '06-water-valley',
    shiftX: 10,
    shiftY: 5,
    motion: 'static',
    canonical: 'L2',
    fxPending: 'water-shimmer',
  },
  { file: '07-sect-ground', shiftX: 12, shiftY: 6, motion: 'static', canonical: 'L3' },
  { file: '08-low-mist', shiftX: 14, shiftY: 7, motion: 'mist-slow', canonical: 'L5' },
  { file: '09-foreground', shiftX: 18, shiftY: 9, motion: 'static', canonical: 'L2' },
]

export type DongFuLayerMotion = 'static' | 'cloud-slow' | 'cloud-medium' | 'mist-slow'

export type DongFuCanonicalLayer = 'L0' | 'L1' | 'L2' | 'L3' | 'L5'

// Pending ambient FX assets (spec SS14.4 candidates) -- flagged like the
// chrome manifest 'pending' entries; no runtime behavior until art lands.
export type DongFuFxPending = 'waterfall-shimmer' | 'water-shimmer'

export interface DongFuLayerDescriptor {
  key: string
  name: string
  url: string
  shiftX: number
  shiftY: number
  motion: DongFuLayerMotion
  canonical: DongFuCanonicalLayer
  fxPending?: DongFuFxPending
}

export const DONG_FU_LAYER_COUNT = TIME_LAYERS.length + SEASON_LAYERS.length

export function dongFuLayerList(variant: ThanhVanVariant): readonly DongFuLayerDescriptor[] {
  return [
    ...TIME_LAYERS.map((layer) => ({
      key: `df-${variant.time}-${layer.file}`,
      name: layer.file,
      url: `/assets/backgrounds/dong-fu/modular/times/${variant.time}/${layer.file}.png`,
      shiftX: layer.shiftX,
      shiftY: layer.shiftY,
      motion: layer.motion,
      canonical: layer.canonical,
    })),
    ...SEASON_LAYERS.map((layer) => ({
      key: `df-${variant.season}-${layer.file}`,
      name: layer.file,
      url: `/assets/backgrounds/dong-fu/modular/seasons/${variant.season}/${layer.file}.png`,
      shiftX: layer.shiftX,
      shiftY: layer.shiftY,
      motion: layer.motion,
      canonical: layer.canonical,
      ...(layer.fxPending !== undefined ? { fxPending: layer.fxPending } : {}),
    })),
  ]
}
