// ThanhVanBackdropArt — WHICH battlefield backdrop is showing, and which files
// it is made of.
//
// §5.4 of
// docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md:
// "the art is a presentation asset". This is that asset — the sixteen-variant
// composition (1 opaque time-of-day sky + 6 transparent season layers, combined
// at runtime rather than duplicating raster), the session's variant lifecycle,
// and the texture keys and URLs it resolves to.
//
// Split out of `src/game/support/ThanhVanArt.ts` (2026-09-11). What stayed
// there is the Phaser DEPTH table and the tint grade: display-list ordering and
// a canvas tint are dynamic-layer facts, and only a scene calls them. What
// moved is everything the STATIC layer was already reaching across the boundary
// to read — `DongFuScene.vue` needs the current variant to pick the matching
// home stack, and `AssetBundleCatalog` needs the load list.
//
// Variant lifecycle (2026-08-26):
//   boot → peekThanhVanVariant() returns a FIXED preset, spring/morning (or a
//   specific QA override) → the first battle uses that preset directly →
//   battle_end → selectNextThanhVanVariant() picks the next one at random
//   (different from the current one where possible) → the scene loads the
//   missing assets while the result overlay is up, then swaps the whole stack.
//
// Deterministic override through localStorage for preview/QA — a CONCRETE
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

/** Preset cố định dùng cho trận ĐẦU TIÊN của phiên (yêu cầu 2026-08-26). */
export const DEFAULT_THANH_VAN_VARIANT: ThanhVanVariant = {
  season: 'spring',

  time: 'morning',
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
    // localStorage unavailable — không có override.
    return undefined
  }
}

function randomFrom<T extends string>(allowed: readonly T[], avoid?: T): T {
  // Ưu tiên KHÁC giá trị cần tránh (nếu pool còn lựa chọn khác).
  const pool =
    avoid !== undefined && allowed.length > 1 ? allowed.filter((value) => value !== avoid) : [...allowed]

  return pool[Math.floor(Math.random() * pool.length)]!
}

let cachedVariant: ThanhVanVariant | undefined

/**
 * Variant của PHIÊN HIỆN TẠI — resolve ĐÚNG MỘT LẦN lúc boot: preset
 * cố định DEFAULT_THANH_VAN_VARIANT trừ khi override QA cụ thể khóa
 * trước. KHÔNG random ở đây nữa (trận đầu dùng ngay preset đã preload);
 * cache được selectNextThanhVanVariant() cập nhật để mọi scene preload
 * sau đó (Home ↔ Combat quay lại) khớp bộ texture đang hiển thị.
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
 * Variant KẾ TIẾP cho trận mới — gọi tại battle_end (KHÔNG còn gọi lúc
 * battle_start). Override QA cụ thể vẫn khóa chiều tương ứng; chiều
 * không khóa thì random và TRÁNH giá trị đang hiển thị nếu có thể
 * (variant mới phải khác variant hiện tại khi được).
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
 * Ghi nhận variant vừa SWAP xong vào cache phiên — CombatScene gọi sau
 * khi backdrop mới thực sự hiển thị, để peekThanhVanVariant() (preload
 * của lần vào combat kế tiếp) trả đúng bộ texture đang có sẵn.
 */
export function commitThanhVanVariant(variant: ThanhVanVariant): void {
  cachedVariant = variant
}

/** Texture key duy nhất cho từng ảnh trong variant. */
export function thanhVanTextureKeys(variant: ThanhVanVariant): string[] {
  return [
    `tv-${variant.time}-sky`,
    ...SEASON_LAYERS.map((layer) => `tv-${variant.season}-${layer}`),
  ]
}

/** Cặp [key, url] để preload đúng thứ tự vẽ (sky trước, atmosphere sau). */
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
