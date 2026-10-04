/**
 * StableSceneArt - typed registry for the delivered Huyen Kim stable
 * scene-art package (game/docs/design/huyen-kim-ui-art-manifest.json +
 * public/assets/ui/huyen-kim/_source/stable-scene-extension.json).
 *
 * This module is the ONLY source of stable-art path literals. Component
 * code resolves layers/symbols through the helpers below; it must never
 * hand-write an `/assets/ui/huyen-kim/...` string.
 *
 * Contract carried verbatim from stable-scene-extension.json:
 * - raster layer: output_base under scene/<surface>/, shipped as
 *   `@1x`/`@2x` PNG pairs; `width`/`height` are the design canvas;
 *   `fit`+`position` define placement; `alpha:false` layers (stack L0)
 *   are the opaque base of each parallax stack.
 * - parallax stacks render in ascending `order`; `max_drift_px` bounds
 *   pointer drift in design px; reduced motion collapses every offset
 *   to exactly 0.
 * - `_source/generated/*-master.png` provenance composites are banned -
 *   runtime imports only the paired `@1x`/`@2x` outputs.
 */

import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const STABLE_ART_BASE = '/assets/ui/huyen-kim/'

export type StableParallaxMotion =
  | 'static'
  | 'far-slow'
  | 'mid'
  | 'ground'
  | 'mist-slow'
  | 'foreground'
  | 'celestial-slow'
  | 'atmosphere'

export interface StableArtParallax {
  readonly stack: string
  readonly depth: string
  readonly order: number
  readonly motion: StableParallaxMotion
  readonly maxDriftPx: { readonly x: number; readonly y: number }
}

export interface StableSceneLayer {
  readonly assetId: string
  /** Public URL stem, e.g. `scene/auth/00-sky`; append `@1x`/`@2x` + `.png`. */
  readonly outputBase: string
  readonly width: number
  readonly height: number
  readonly alpha: boolean
  readonly fit: 'cover' | 'contain' | 'none'
  readonly position: 'center' | 'north' | 'south'
  readonly parallax: StableArtParallax | null
}

/** Resolved DOM layer: everything the parallax presenter needs to draw. */
export interface StableParallaxLayer extends StableSceneLayer {
  readonly parallax: StableArtParallax
  readonly src1x: string
  readonly src2x: string
}

export const STABLE_PARALLAX_STACK_IDS = [
  'auth-creation',
  'realm-ascent',
  'skill-tree',
] as const

export type StableParallaxStackId = (typeof STABLE_PARALLAX_STACK_IDS)[number]

// Registry rows transcribed verbatim from _source/stable-scene-extension.json
// `assets[]` (26 entries). Field names normalized camelCase; values unchanged.
const STABLE_SCENE_LAYERS: readonly StableSceneLayer[] = [
  {
    assetId: 'auth-creation-00-sky',
    outputBase: 'scene/auth/00-sky',
    width: 1672, height: 941, alpha: false, fit: 'cover', position: 'center',
    parallax: { stack: 'auth-creation', depth: 'L0', order: 0, motion: 'static', maxDriftPx: { x: 0, y: 0 } },
  },
  {
    assetId: 'auth-creation-01-far-mountains',
    outputBase: 'scene/auth/01-far-mountains',
    width: 1672, height: 941, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'auth-creation', depth: 'L1', order: 1, motion: 'far-slow', maxDriftPx: { x: 4, y: 2 } },
  },
  {
    assetId: 'auth-creation-02-mid-landscape',
    outputBase: 'scene/auth/02-mid-landscape',
    width: 1672, height: 941, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'auth-creation', depth: 'L2', order: 2, motion: 'mid', maxDriftPx: { x: 8, y: 4 } },
  },
  {
    assetId: 'auth-creation-03-focal-architecture',
    outputBase: 'scene/auth/03-focal-architecture',
    width: 1672, height: 941, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'auth-creation', depth: 'L3', order: 3, motion: 'ground', maxDriftPx: { x: 10, y: 5 } },
  },
  {
    assetId: 'auth-creation-04-low-mist',
    outputBase: 'scene/auth/04-low-mist',
    width: 1672, height: 941, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'auth-creation', depth: 'L4', order: 4, motion: 'mist-slow', maxDriftPx: { x: 12, y: 6 } },
  },
  {
    assetId: 'auth-creation-05-foreground',
    outputBase: 'scene/auth/05-foreground',
    width: 1672, height: 941, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'auth-creation', depth: 'L5', order: 5, motion: 'foreground', maxDriftPx: { x: 18, y: 9 } },
  },
  {
    assetId: 'realm-ascent-00-sky',
    outputBase: 'scene/realm/00-sky',
    width: 812, height: 610, alpha: false, fit: 'cover', position: 'center',
    parallax: { stack: 'realm-ascent', depth: 'L0', order: 0, motion: 'static', maxDriftPx: { x: 0, y: 0 } },
  },
  {
    assetId: 'realm-ascent-01-far-mountains',
    outputBase: 'scene/realm/01-far-mountains',
    width: 812, height: 610, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'realm-ascent', depth: 'L1', order: 1, motion: 'far-slow', maxDriftPx: { x: 3, y: 2 } },
  },
  {
    assetId: 'realm-ascent-02-mid-ascent',
    outputBase: 'scene/realm/02-mid-ascent',
    width: 812, height: 610, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'realm-ascent', depth: 'L2', order: 2, motion: 'mid', maxDriftPx: { x: 6, y: 3 } },
  },
  {
    assetId: 'realm-ascent-03-summit-architecture',
    outputBase: 'scene/realm/03-summit-architecture',
    width: 812, height: 610, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'realm-ascent', depth: 'L3', order: 3, motion: 'ground', maxDriftPx: { x: 8, y: 4 } },
  },
  {
    assetId: 'realm-ascent-04-low-mist',
    outputBase: 'scene/realm/04-low-mist',
    width: 812, height: 610, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'realm-ascent', depth: 'L4', order: 4, motion: 'mist-slow', maxDriftPx: { x: 10, y: 5 } },
  },
  {
    assetId: 'skill-tree-00-sky',
    outputBase: 'scene/skill/00-sky',
    width: 640, height: 470, alpha: false, fit: 'cover', position: 'center',
    parallax: { stack: 'skill-tree', depth: 'L0', order: 0, motion: 'static', maxDriftPx: { x: 0, y: 0 } },
  },
  {
    assetId: 'skill-tree-01-far-mountains',
    outputBase: 'scene/skill/01-far-mountains',
    width: 640, height: 470, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'skill-tree', depth: 'L1', order: 1, motion: 'far-slow', maxDriftPx: { x: 3, y: 2 } },
  },
  {
    assetId: 'skill-tree-02-celestial-field',
    outputBase: 'scene/skill/02-celestial-field',
    width: 640, height: 470, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'skill-tree', depth: 'L2', order: 2, motion: 'celestial-slow', maxDriftPx: { x: 5, y: 2 } },
  },
  {
    assetId: 'skill-tree-03-atmosphere',
    outputBase: 'scene/skill/03-atmosphere',
    width: 640, height: 470, alpha: true, fit: 'cover', position: 'center',
    parallax: { stack: 'skill-tree', depth: 'L3', order: 3, motion: 'atmosphere', maxDriftPx: { x: 8, y: 4 } },
  },
  {
    assetId: 'body-cultivation-figure',
    outputBase: 'scene/body/body-cultivation-figure',
    width: 640, height: 520, alpha: true, fit: 'contain', position: 'center',
    parallax: null,
  },
  {
    assetId: 'body-meridian-overlay',
    outputBase: 'scene/body/body-meridian-overlay',
    width: 640, height: 520, alpha: true, fit: 'none', position: 'center',
    parallax: null,
  },
  {
    assetId: 'technique-display-plinth',
    outputBase: 'scene/technique/technique-display-plinth',
    width: 448, height: 480, alpha: true, fit: 'contain', position: 'south',
    parallax: null,
  },
  {
    assetId: 'equipment-paperdoll-base',
    outputBase: 'scene/equipment/equipment-paperdoll-base',
    width: 380, height: 610, alpha: true, fit: 'contain', position: 'center',
    parallax: null,
  },
  {
    assetId: 'exploration-map-frame',
    outputBase: 'scene/map/exploration-map-frame',
    width: 700, height: 524, alpha: true, fit: 'none', position: 'center',
    parallax: null,
  },
  {
    assetId: 'exploration-map-mask',
    outputBase: 'scene/map/exploration-map-mask',
    width: 700, height: 524, alpha: true, fit: 'none', position: 'center',
    parallax: null,
  },
  {
    assetId: 'exploration-chapter-divider',
    outputBase: 'scene/map/exploration-chapter-divider',
    width: 620, height: 16, alpha: true, fit: 'none', position: 'center',
    parallax: null,
  },
  {
    assetId: 'tribulation-storm-far',
    outputBase: 'scene/tribulation/tribulation-storm-far',
    width: 1672, height: 941, alpha: true, fit: 'contain', position: 'north',
    parallax: null,
  },
  {
    assetId: 'tribulation-storm-near',
    outputBase: 'scene/tribulation/tribulation-storm-near',
    width: 1672, height: 941, alpha: true, fit: 'contain', position: 'north',
    parallax: null,
  },
  {
    assetId: 'tribulation-dais',
    outputBase: 'scene/tribulation/tribulation-dais',
    width: 1672, height: 941, alpha: true, fit: 'contain', position: 'south',
    parallax: null,
  },
  {
    assetId: 'tribulation-sky-vignette',
    outputBase: 'scene/tribulation/tribulation-sky-vignette',
    width: 1672, height: 941, alpha: true, fit: 'cover', position: 'center',
    parallax: null,
  },
]

const LAYER_BY_ID = new Map(STABLE_SCENE_LAYERS.map((layer) => [layer.assetId, layer]))

export function stableSceneArtUrl(assetId: string, density: '@1x' | '@2x' = '@1x'): string {
  const layer = LAYER_BY_ID.get(assetId)
  if (!layer) {
    throw new Error(`StableSceneArt: unknown asset id "${assetId}"`)
  }
  return resolveAssetUrl(`${STABLE_ART_BASE}${layer.outputBase}${density}.png`)
}

export function stableSceneLayer(assetId: string): StableSceneLayer {
  const layer = LAYER_BY_ID.get(assetId)
  if (!layer) {
    throw new Error(`StableSceneArt: unknown asset id "${assetId}"`)
  }
  return layer
}

/** Ordered DOM-ready layers for one parallax stack (manifest order = ascending `order`). */
export function stableParallaxStack(stackId: StableParallaxStackId): StableParallaxLayer[] {
  return STABLE_SCENE_LAYERS.filter(
    (layer): layer is StableSceneLayer & { parallax: StableArtParallax } =>
      layer.parallax?.stack === stackId,
  )
    .sort((left, right) => left.parallax.order - right.parallax.order)
    .map((layer) => ({
      ...layer,
      src1x: resolveAssetUrl(`${STABLE_ART_BASE}${layer.outputBase}@1x.png`),
      src2x: resolveAssetUrl(`${STABLE_ART_BASE}${layer.outputBase}@2x.png`),
    }))
}

// ---- SVG symbols (huyen-kim-ui-symbol-set) ----
// Symbols are tintable: the SVGs paint currentColor, so consumers color
// them with CSS `color`. Runtime owns state/tint per the handoff.

export const STABLE_SYMBOL_IDS = [
  'back', 'close', 'home', 'character', 'realm', 'skill', 'body',
  'technique', 'inventory', 'exploration', 'alchemy', 'equipment',
  'quest', 'settings', 'feedback', 'auto-farm', 'confirm', 'lock',
  'talent-bach_luyen_thanh_khi', 'talent-bat_tu_the', 'talent-can_than',
  'talent-hai_na', 'talent-hap_linh', 'talent-ho_the',
  'talent-ho_tich_bat_phat', 'talent-hoa_hau_thong_than', 'talent-kd_linh_dan',
  'talent-kd_thanh_dan', 'talent-kiem_quang', 'talent-lk_bac_hai',
  'talent-lk_dung_nap', 'talent-lk_linh_mach', 'talent-lk_ngo_tinh',
  'talent-lk_tam_tue', 'talent-loi_kiep', 'talent-ngo_dao',
  'talent-pha_giap', 'talent-pham_cot', 'talent-pham_nhan_chi_cot',
  'talent-phu_van', 'talent-tat_phong', 'talent-tc_dia_can',
  'talent-tc_huyet_nhuc', 'talent-tc_kim_lan', 'talent-tc_linh_giac',
  'talent-tc_thien_co', 'talent-tc_truc_hon', 'talent-thach_giap',
  'talent-thu_phat', 'talent-tran_tam', 'talent-trong_kich',
  'talent-van_dao', 'talent-vo_anh',
] as const

const stableSymbolIdSet = new Set<string>(STABLE_SYMBOL_IDS)

// Maps a talent id to its dedicated glyph, or `fallback` when the id has
// no shipped glyph yet.
export function talentSymbolId(talentId: string, fallback: StableSymbolId = 'character'): StableSymbolId {
  const id = `talent-${talentId}`
  return stableSymbolIdSet.has(id) ? (id as StableSymbolId) : fallback
}

export type StableSymbolId = (typeof STABLE_SYMBOL_IDS)[number]

export function stableSymbolUrl(id: StableSymbolId): string {
  return resolveAssetUrl(`${STABLE_ART_BASE}symbols/${id}.svg`)
}
