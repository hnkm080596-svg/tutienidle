// CombatAnimationSet (Combat Art Pipeline spec §5, 2026-09-05) — metadata
// animation sprite sheet, mỗi clip ứng với 1 phase của Action Playback.
// buildPlaceholderAnimationSet() dùng chung 1 sheet placeholder 32-frame
// cho mọi entity (sinh bởi scripts/generate-hon-don-tran-placeholder-art.mjs),
// cho phép test AnimationManager end-to-end. Khi có sheet thật nhiều-frame
// thật sự được đưa vào sau (asset-drop workflow), chỉ cần đổi nội dung
// định nghĩa — không đụng code path nào.
export type CombatAnimationName = 'idle' | 'ready' | 'cast' | 'standby' | 'death'

export interface CombatAnimationClip {
  key: string
  sheetKey: string
  sheetUrl: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  frameRate: number
  /** -1 = loop (idle/ready/standby), 0 = play once (cast/death). */
  repeat: number
}

export type CombatAnimationSet = Record<CombatAnimationName, CombatAnimationClip>

const LOOPING_NAMES: readonly CombatAnimationName[] = ['idle', 'ready', 'standby']
const ONE_SHOT_NAMES: readonly CombatAnimationName[] = ['cast', 'death']

const ALL_NAMES: readonly CombatAnimationName[] = [...LOOPING_NAMES, ...ONE_SHOT_NAMES]

// Hỗn Độn Trận visual test tooling (2026-09-06) — sheet placeholder DUY
// NHẤT dùng chung cho mọi entity (sinh bởi
// scripts/generate-hon-don-tran-placeholder-art.mjs). sheetKey CHIA SẺ
// giữa mọi entity/clip (khác `key`, vẫn per-entity) — queueCombatAssets()
// (CombatPreload.ts) đã dedupe theo sheetKey nên texture chỉ tải 1 LẦN
// DUY NHẤT dù hàng chục entity cùng dùng, không cần sửa gì ở đó. Khi có
// content thật, chỉ cần đổi các hằng số này — không đụng consumer nào.
export const PLACEHOLDER_SHEET_KEY = 'combat-placeholder-32frame-sheet'
export const PLACEHOLDER_SHEET_URL = 'assets/characters/placeholder/combat-anim-32frame.png'
export const PLACEHOLDER_FRAME_WIDTH = 200
export const PLACEHOLDER_FRAME_HEIGHT = 350
export const PLACEHOLDER_FRAME_COUNT = 32
export const PLACEHOLDER_FRAME_RATE = 8

// Task 9 (2026-09-05) — nguồn DUY NHẤT cho format animation key, để
// CombatScene.ts tính đúng animation key khi gọi sprite.play() mà không
// phải dựng lại cả CombatAnimationSet chỉ để đọc 1 field .key. sheetKey
// (khác key) giờ là hằng số CHIA SẺ PLACEHOLDER_SHEET_KEY ở trên, không
// còn tính theo entityKey/name nữa (xem comment Hỗn Độn Trận 2026-09-06).
export function combatAnimationKey(entityKey: string, name: CombatAnimationName): string {
  return `${entityKey}-${name}`
}

export function buildPlaceholderAnimationSet(
  entityKey: string,
  _staticTextureUrl: string,
  _frameSize: { width: number; height: number } = { width: 256, height: 256 },
): CombatAnimationSet {
  const entries = ALL_NAMES.map((name) => {
    const clip: CombatAnimationClip = {
      key: combatAnimationKey(entityKey, name),
      sheetKey: PLACEHOLDER_SHEET_KEY,
      sheetUrl: PLACEHOLDER_SHEET_URL,
      frameWidth: PLACEHOLDER_FRAME_WIDTH,
      frameHeight: PLACEHOLDER_FRAME_HEIGHT,
      frameCount: PLACEHOLDER_FRAME_COUNT,
      frameRate: PLACEHOLDER_FRAME_RATE,
      repeat: LOOPING_NAMES.includes(name) ? -1 : 0,
    }

    return [name, clip] as const
  })

  return Object.fromEntries(entries) as CombatAnimationSet
}
