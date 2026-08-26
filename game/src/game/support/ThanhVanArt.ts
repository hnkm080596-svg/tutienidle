// ThanhVanArt (thanh-van-dong-fu-art-production-plan.md §10-11) — nguồn
// sự thật cho variant nền chiến trường modular: 1 sky thời gian trong
// ngày (opaque) + 6 layer mùa trong suốt, ghép runtime thành 16 biến thể
// mà không nhân bản raster.
//
// Vòng đời variant (2026-08-26):
//   boot → peekThanhVanVariant() trả PRESET CỐ ĐỊNH spring/morning
//   (hoặc override QA cụ thể) → trận ĐẦU dùng ngay preset này →
//   battle_end → selectNextThanhVanVariant() chọn ngẫu nhiên variant kế
//   tiếp (khác variant hiện tại nếu có thể) → scene load thiếu asset
//   trong lúc overlay kết quả đang hiện rồi swap nguyên khối.
//
// Override deterministic qua localStorage cho preview/QA — GIÁ TRỊ CỤ THỂ
// khóa variant tương ứng ở cả boot lẫn các lần chọn kế tiếp; 'random'
// hoặc không set = tham gia vòng random sau mỗi trận:
//   dev.thanhvanSeason = spring|summer|autumn|winter|random
//   dev.thanhvanTime   = morning|noon|evening|night|random

import {
  DEPTH_BACKGROUND,
  DEPTH_BACKGROUND_ATMOSPHERE,
  DEPTH_BACKGROUND_BATTLE_GROUND,
  DEPTH_BACKGROUND_FAR_MOUNTAINS,
  DEPTH_BACKGROUND_FOREGROUND,
  DEPTH_BACKGROUND_MIDGROUND,
  DEPTH_BACKGROUND_SKY,
} from './BattleLayers'

export const THANH_VAN_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const

export const THANH_VAN_TIMES = ['morning', 'noon', 'evening', 'night'] as const

export type ThanhVanSeason = (typeof THANH_VAN_SEASONS)[number]

export type ThanhVanTime = (typeof THANH_VAN_TIMES)[number]

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

export interface ThanhVanVariant {
  season: ThanhVanSeason

  time: ThanhVanTime
}

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

/**
 * Depth tường minh THEO TEXTURE KEY (yêu cầu 2026-08-26 — hết dựa vào
 * insertion order): sky < far mountains < midground < atmosphere
 * < battle ground < foreground left/right; grading thời gian nằm TRÊN
 * cùng (DEPTH_THANH_VAN_TIME_GRADE). Mọi depth background đều nhỏ hơn
 * DEPTH_GROUND_GRID. Lưu ý atmosphere DƯỚI battle ground (art sương/mưa
 * phải bị mặt đất che phần thấp) và foreground TRÊN battle ground.
 */
export function thanhVanLayerDepth(textureKey: string): number {
  if (textureKey.endsWith('-sky')) {
    return DEPTH_BACKGROUND_SKY
  }

  if (textureKey.endsWith('-01-far-mountains')) {
    return DEPTH_BACKGROUND_FAR_MOUNTAINS
  }

  if (textureKey.endsWith('-02-midground')) {
    return DEPTH_BACKGROUND_MIDGROUND
  }

  if (textureKey.endsWith('-06-atmosphere')) {
    return DEPTH_BACKGROUND_ATMOSPHERE
  }

  if (textureKey.endsWith('-03-battle-ground')) {
    return DEPTH_BACKGROUND_BATTLE_GROUND
  }

  if (textureKey.endsWith('-04-foreground-left') || textureKey.endsWith('-05-foreground-right')) {
    return DEPTH_BACKGROUND_FOREGROUND
  }

  // Key lạ — về đáy stack để không đè lên grid/entity.
  return DEPTH_BACKGROUND
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

/**
 * Grading nhẹ theo giờ (README modular §"Suggested runtime grading") —
 * phủ một lớp màu mờ TRÊN cùng stack; undefined = không grading thêm.
 */
export function thanhVanTimeGrade(time: ThanhVanTime): { color: number; alpha: number } | undefined {
  switch (time) {
    case 'noon':
      return { color: 0xfff4d6, alpha: 0.04 }

    case 'evening':
      return { color: 0xc2571f, alpha: 0.14 }

    case 'night':
      return { color: 0x141830, alpha: 0.38 }

    default:
      return undefined
  }
}
