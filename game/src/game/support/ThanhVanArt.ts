// ThanhVanArt - the Phaser-side facts about the battlefield backdrop: the
// explicit DEPTH of each layer, and the time-of-day tint laid over the stack.
//
// The art itself - which variant is showing, its texture keys, its load list -
// moved to `presentation/background/ThanhVanBackdropArt.ts` (sec5.4, 2026-09-11),
// because the static layer was already reading it across the boundary. What
// remains here is display-list ordering and a canvas tint, which only a scene
// calls and which mean nothing to the DOM.
//
// Everything that moved is re-exported below, so the scenes that import both
// halves from this module keep working unchanged.
import {
  DEPTH_BACKGROUND,
  DEPTH_BACKGROUND_ATMOSPHERE,
  DEPTH_BACKGROUND_BATTLE_GROUND,
  DEPTH_BACKGROUND_FAR_MOUNTAINS,
  DEPTH_BACKGROUND_FOREGROUND,
  DEPTH_BACKGROUND_MIDGROUND,
  DEPTH_BACKGROUND_SKY,
} from './BattleLayers'
import type { ThanhVanTime } from '@/presentation/background/BackgroundVariant'

export {
  THANH_VAN_SEASONS,
  THANH_VAN_TIMES,
  type ThanhVanSeason,
  type ThanhVanTime,
  type ThanhVanVariant,
} from '@/presentation/background/BackgroundVariant'

export {
  THANH_VAN_CANVAS,
  DEFAULT_THANH_VAN_VARIANT,
  peekThanhVanVariant,
  selectNextThanhVanVariant,
  commitThanhVanVariant,
  thanhVanTextureKeys,
  thanhVanLoadList,
} from '@/presentation/background/ThanhVanBackdropArt'

/**
 * Depth tuong minh THEO TEXTURE KEY (yeu cau 2026-08-26 - het dua vao
 * insertion order): sky < far mountains < midground < atmosphere
 * < battle ground < foreground left/right; grading thoi gian nam TREN
 * cung (DEPTH_THANH_VAN_TIME_GRADE). Moi depth background deu nho hon
 * DEPTH_GROUND_GRID. Luu y atmosphere DUOI battle ground (art suong/mua
 * phai bi mat dat che phan thap) va foreground TREN battle ground.
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

  // Key la - ve day stack de khong de len grid/entity.
  return DEPTH_BACKGROUND
}

/**
 * Grading nhe theo gio (README modular sec"Suggested runtime grading") -
 * phu mot lop mau mo TREN cung stack; undefined = khong grading them.
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
