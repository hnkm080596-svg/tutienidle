// ThanhVanBackdropArt - WHICH battlefield backdrop is showing, and which files
// it is made of.
//
// sec5.4 of
// docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md:
// "the art is a presentation asset". This is that asset - the sixteen-variant
// composition (1 opaque time-of-day sky + 6 transparent season layers, combined
// at runtime rather than duplicating raster), the session's variant lifecycle,
// and the texture keys and URLs it resolves to.
//
// Split out of `src/game/support/ThanhVanArt.ts` (2026-09-11). What stayed
// there is the Phaser DEPTH table and the tint grade: display-list ordering and
// a canvas tint are dynamic-layer facts, and only a scene calls them. What
// moved is everything the STATIC layer was already reaching across the boundary
// to read - `DongFuScene.vue` needs the current variant to pick the matching
// home stack, and `AssetBundleCatalog` needs the load list.
//
// Variant lifecycle (2026-08-26):
//   boot -> peekThanhVanVariant() returns a FIXED preset, spring/morning (or a
//   specific QA override) -> the first battle uses that preset directly ->
//   battle_end -> selectNextThanhVanVariant() picks the next one at random
//   (different from the current one where possible) -> the scene loads the
//   missing assets while the result overlay is up, then swaps the whole stack.
//
// Deterministic override through localStorage for preview/QA - a CONCRETE
// value locks that dimension at boot and at every later selection; 'random' or
// unset means it takes part in the post-battle roll:
//   dev.thanhvanSeason = spring|summer|autumn|winter|random
//   dev.thanhvanTime   = morning|noon|evening|night|random
import {
  THANH_VAN_SEASONS,
  THANH_VAN_TIMES,
  type ThanhVanVariant,
} from './BackgroundVariant'

export const THANH_VAN_CANVAS = { w: 1672, h: 941 } as const

/** Fixed preset for the session's FIRST battle (requirement 2026-08-26).
 *  Huyen Kim S03 (2026-10-02): autumn/night = moonlit blue-gold reference
 *  kit - still a deterministic boot preset; QA overrides unchanged. */
export const DEFAULT_THANH_VAN_VARIANT: ThanhVanVariant = {
  season: 'autumn',

  time: 'night',
}

const SEASON_LAYERS = [
  '01-far-mountains',
  '02-midground',
  '03-battle-ground',
  '04-foreground-left',
  '05-foreground-right',
  '06-atmosphere',
] as const

function readConcreteOverride<T extends string>(key: string, allowed: readonly T[]): T | undefined {
  try {
    const value = window.localStorage.getItem(key)

    return typeof value === 'string' && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : undefined
  } catch {
    // localStorage unavailable - khong co override.
    return undefined
  }
}

function randomFrom<T extends string>(allowed: readonly T[], avoid?: T): T {
  // Uu tien KHAC gia tri can tranh (neu pool con lua chon khac).
  const pool =
    avoid !== undefined && allowed.length > 1 ? allowed.filter((value) => value !== avoid) : [...allowed]

  return pool[Math.floor(Math.random() * pool.length)]!
}

let cachedVariant: ThanhVanVariant | undefined

/**
 * Variant cua PHIEN HIEN TAI - resolve DUNG MOT LAN luc boot: preset
 * co dinh DEFAULT_THANH_VAN_VARIANT tru khi override QA cu the khoa
 * truoc. KHONG random o day nua (tran dau dung ngay preset da preload);
 * cache duoc selectNextThanhVanVariant() cap nhat de moi scene preload
 * sau do (Home <-> Combat quay lai) khop bo texture dang hien thi.
 */
export function peekThanhVanVariant(): ThanhVanVariant {
  cachedVariant ??= {
    season:
      readConcreteOverride('dev.thanhvanSeason', THANH_VAN_SEASONS) ??
      DEFAULT_THANH_VAN_VARIANT.season,

    time: readConcreteOverride('dev.thanhvanTime', THANH_VAN_TIMES) ?? DEFAULT_THANH_VAN_VARIANT.time,
  }

  return cachedVariant
}

/**
 * Variant KE TIEP cho tran moi - goi tai battle_end (KHONG con goi luc
 * battle_start). Override QA cu the van khoa chieu tuong ung; chieu
 * khong khoa thi random va TRANH gia tri dang hien thi neu co the
 * (variant moi phai khac variant hien tai khi duoc).
 */
export function selectNextThanhVanVariant(current: ThanhVanVariant): ThanhVanVariant {
  return {
    season:
      readConcreteOverride('dev.thanhvanSeason', THANH_VAN_SEASONS) ??
      randomFrom(THANH_VAN_SEASONS, current.season),

    time:
      readConcreteOverride('dev.thanhvanTime', THANH_VAN_TIMES) ?? randomFrom(THANH_VAN_TIMES, current.time),
  }
}

/**
 * Ghi nhan variant vua SWAP xong vao cache phien - CombatScene goi sau
 * khi backdrop moi thuc su hien thi, de peekThanhVanVariant() (preload
 * cua lan vao combat ke tiep) tra dung bo texture dang co san.
 */
export function commitThanhVanVariant(variant: ThanhVanVariant): void {
  cachedVariant = variant
}

/** Texture key duy nhat cho tung anh trong variant. */
export function thanhVanTextureKeys(variant: ThanhVanVariant): string[] {
  return [
    `tv-${variant.time}-sky`,
    ...SEASON_LAYERS.map((layer) => `tv-${variant.season}-${layer}`),
  ]
}

/** Cap [key, url] de preload dung thu tu ve (sky truoc, atmosphere sau). */
export function thanhVanLoadList(variant: ThanhVanVariant): Array<{ key: string; url: string }> {
  return [
    {
      key: `tv-${variant.time}-sky`,

      url: `/assets/backgrounds/thanh-van/modular/times/${variant.time}/00-sky.png`,
    },

    ...SEASON_LAYERS.map((layer) => ({
      key: `tv-${variant.season}-${layer}`,

      url: `/assets/backgrounds/thanh-van/modular/seasons/${variant.season}/${layer}.png`,
    })),
  ]
}
