import type { ThanhVanVariant } from './ThanhVanArt'

const TIME_LAYERS = [
  { file: '00-sky', shiftX: 0, shiftY: 0, motion: 'static' },
  { file: '01-high-clouds', shiftX: 1, shiftY: 1, motion: 'cloud-slow' },
  { file: '02-light-veil', shiftX: 2, shiftY: 1, motion: 'cloud-medium' },
] as const

const SEASON_LAYERS = [
  { file: '03-far-mountains', shiftX: 4, shiftY: 2, motion: 'static' },
  { file: '04-distant-ledges', shiftX: 6, shiftY: 3, motion: 'static' },
  { file: '05-mid-landscape', shiftX: 8, shiftY: 4, motion: 'static' },
  { file: '06-water-valley', shiftX: 10, shiftY: 5, motion: 'static' },
  { file: '07-sect-ground', shiftX: 12, shiftY: 6, motion: 'static' },
  { file: '08-low-mist', shiftX: 14, shiftY: 7, motion: 'mist-slow' },
  { file: '09-foreground', shiftX: 18, shiftY: 9, motion: 'static' },
] as const

export type DongFuLayerMotion = 'static' | 'cloud-slow' | 'cloud-medium' | 'mist-slow'

export interface DongFuLayerDescriptor {
  key: string
  name: string
  url: string
  shiftX: number
  shiftY: number
  motion: DongFuLayerMotion
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
    })),
    ...SEASON_LAYERS.map((layer) => ({
      key: `df-${variant.season}-${layer.file}`,
      name: layer.file,
      url: `/assets/backgrounds/dong-fu/modular/seasons/${variant.season}/${layer.file}.png`,
      shiftX: layer.shiftX,
      shiftY: layer.shiftY,
      motion: layer.motion,
    })),
  ]
}
