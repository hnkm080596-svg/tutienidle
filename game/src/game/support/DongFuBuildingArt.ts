import type { ThanhVanSeason, ThanhVanTime } from './ThanhVanArt'

export const DONG_FU_BUILDING_IDS = [
  'spirit_spring',
  'equipment_hall',
  'pill_room',
  'teleport_array',
  'gathering_outpost',
] as const

export type DongFuBuildingId = (typeof DONG_FU_BUILDING_IDS)[number]

interface PixelRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

interface PixelPoint {
  readonly x: number
  readonly y: number
}

export interface DongFuBuildingArtEntry {
  readonly buildingId: DongFuBuildingId
  readonly canvas: { readonly width: 1254; readonly height: 1254 }
  readonly visualBounds: PixelRect
  readonly baselineY: number
  readonly hitbox: PixelRect
  readonly scenePlacement: Readonly<{
    xPercent: number
    yPercent: number
    scale: number
    zIndex: number
  }>
  readonly futureVfxAnchors: Readonly<Record<string, PixelPoint>>
}

export interface DongFuBuildingAssetUrls {
  readonly base: string
  readonly silhouetteMask: string
  readonly groundShadow: string
  readonly lockedOverlay: string
}

export const DONG_FU_BUILDING_ART: readonly DongFuBuildingArtEntry[] = [
  {
    buildingId: 'pill_room',
    canvas: { width: 1254, height: 1254 },
    visualBounds: { x: 114, y: 118, width: 1028, height: 914 },
    baselineY: 1032,
    hitbox: { x: 217, y: 621, width: 822, height: 411 },
    scenePlacement: { xPercent: 16, yPercent: 63, scale: 0.21, zIndex: 11 },
    futureVfxAnchors: {
      entrance: { x: 627, y: 900 },
      roof: { x: 627, y: 350 },
      functionCore: { x: 627, y: 820 },
    },
  },
  {
    buildingId: 'gathering_outpost',
    canvas: { width: 1254, height: 1254 },
    visualBounds: { x: 0, y: 298, width: 1254, height: 604 },
    baselineY: 902,
    hitbox: { x: 125, y: 630, width: 1004, height: 272 },
    scenePlacement: { xPercent: 83, yPercent: 62, scale: 0.22, zIndex: 12 },
    futureVfxAnchors: {
      entrance: { x: 627, y: 830 },
      roof: { x: 627, y: 390 },
      functionCore: { x: 627, y: 690 },
    },
  },
  {
    buildingId: 'teleport_array',
    canvas: { width: 1254, height: 1254 },
    visualBounds: { x: 86, y: 167, width: 1075, height: 882 },
    baselineY: 1049,
    hitbox: { x: 194, y: 652, width: 860, height: 397 },
    scenePlacement: { xPercent: 58, yPercent: 58, scale: 0.19, zIndex: 10 },
    futureVfxAnchors: {
      entrance: { x: 627, y: 1010 },
      roof: { x: 627, y: 275 },
      functionCore: { x: 627, y: 610 },
    },
  },
  {
    buildingId: 'equipment_hall',
    canvas: { width: 1254, height: 1254 },
    visualBounds: { x: 85, y: 185, width: 1133, height: 756 },
    baselineY: 941,
    hitbox: { x: 198, y: 601, width: 906, height: 340 },
    scenePlacement: { xPercent: 28, yPercent: 74, scale: 0.27, zIndex: 21 },
    futureVfxAnchors: {
      entrance: { x: 650, y: 875 },
      roof: { x: 650, y: 390 },
      functionCore: { x: 625, y: 770 },
    },
  },
  {
    buildingId: 'spirit_spring',
    canvas: { width: 1254, height: 1254 },
    visualBounds: { x: 0, y: 294, width: 1244, height: 659 },
    baselineY: 953,
    hitbox: { x: 124, y: 657, width: 995, height: 296 },
    scenePlacement: { xPercent: 74, yPercent: 75, scale: 0.28, zIndex: 22 },
    futureVfxAnchors: {
      entrance: { x: 627, y: 920 },
      roof: { x: 627, y: 390 },
      functionCore: { x: 627, y: 740 },
    },
  },
]

export function dongFuBuildingAssetUrls(entry: DongFuBuildingArtEntry): DongFuBuildingAssetUrls {
  const root = `/assets/buildings/dong-fu/v2/${entry.buildingId}`

  return {
    base: `${root}/base.png`,
    silhouetteMask: `${root}/silhouette-mask.png`,
    groundShadow: `${root}/ground-shadow.png`,
    lockedOverlay: `${root}/locked-overlay.png`,
  }
}

export function dongFuSeasonOverlayUrl(season: ThanhVanSeason): string {
  return `/assets/buildings/dong-fu/v2/shared/seasons/${season}.png`
}

export function dongFuBuildingTimeClass(time: ThanhVanTime): `is-time-${ThanhVanTime}` {
  return `is-time-${time}`
}
