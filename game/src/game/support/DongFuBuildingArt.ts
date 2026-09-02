import type { ThanhVanSeason, ThanhVanTime } from './ThanhVanArt'

export const DONG_FU_BUILDING_IDS = [
  'chi_hien_quan',
  'equipment_hall',
  'pill_room',
  'teleport_array',
  'gathering_outpost',
  'vendor',
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
    scenePlacement: { xPercent: 13, yPercent: 58, scale: 0.1, zIndex: 11 },
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
    scenePlacement: { xPercent: 68.5, yPercent: 45.5, scale: 0.05, zIndex: 21 },
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
    scenePlacement: { xPercent: 90, yPercent: 80, scale: 0.2, zIndex: 10 },
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
    scenePlacement: { xPercent: 25, yPercent: 45, scale: 0.1, zIndex: 20 },
    futureVfxAnchors: {
      entrance: { x: 650, y: 875 },
      roof: { x: 650, y: 390 },
      functionCore: { x: 625, y: 770 },
    },
  },
  {
    // Ký Bảo Các (2026-08-30) — building CHUYÊN cho Hóa Bán/quy đổi
    // (VendorPanel.vue). Bounds/hitbox tạm dùng tỉ lệ trung bình giống
    // Truyền Tống Trận cho tới khi có asset thật (asset-drop convention,
    // v2/vendor/*.png) — degrade an toàn qua has-asset-error, hotspot
    // vẫn bấm được nhờ hitbox %.
    buildingId: 'vendor',
    canvas: { width: 1254, height: 1254 },
    visualBounds: { x: 150, y: 200, width: 950, height: 850 },
    baselineY: 1050,
    hitbox: { x: 200, y: 600, width: 850, height: 380 },
    scenePlacement: { xPercent: 80, yPercent: 46, scale: 0.05, zIndex: 15 },
    futureVfxAnchors: {
      entrance: { x: 627, y: 950 },
      roof: { x: 627, y: 320 },
      functionCore: { x: 627, y: 750 },
    },
  },
  {
    // chi_hien_quan — placeholder layout tái dùng entry Linh Tuyền cũ
    // (art v2 riêng làm theo dong-fu pipeline đợt sau).
    buildingId: 'chi_hien_quan',
    canvas: { width: 1254, height: 1254 },
    visualBounds: { x: 0, y: 294, width: 1244, height: 659 },
    baselineY: 953,
    hitbox: { x: 124, y: 657, width: 995, height: 296 },
    scenePlacement: { xPercent: 40, yPercent: 55, scale: 0.1, zIndex: 22 },
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
