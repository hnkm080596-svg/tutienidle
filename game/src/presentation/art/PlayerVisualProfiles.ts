// PlayerVisualProfiles (player-body-anchor-reward-gourd-plan §4.1) —
// catalog hình ảnh Player theo hình thái: texture combat, texture tu
// luyện và bảng body anchor chuẩn hoá (tỷ lệ 0..1 của ảnh nguồn).
//
// Policy hình thái (plan §2):
// - `mortal`: art Phàm Nhân mới (combat + kiết già tu luyện).
// - `phap_tu`: art Pháp Tu mới trong combat; tu luyện tạm dùng fallback
//   Phàm Nhân đã thống nhất.
// - `kiem_tu`: CHƯA có art riêng — fallback toàn bộ sang Phàm Nhân.
//
// Scenes chỉ nhận PROFILE ID (không cầm Player store/GameManager) qua
// Phaser registry + event `player_visual_profile_changed`.

export type PlayerVisualProfileId = 'mortal' | 'phap_tu' | 'kiem_tu'

/** Điểm bám VFX chuẩn hoá trên ảnh nguồn (plan §5.1). */
export type PlayerBodyAnchorId =
  | 'head'
  | 'chest'
  | 'castHand'
  | 'offHand'
  | 'feet'

export interface NormalizedBodyAnchor {
  x: number

  y: number
}

export interface PlayerVisualProfile {
  id: PlayerVisualProfileId

  /** Texture đứng (combat) — static art thay cho atlas idle cũ. */
  combatTextureKey: string

  combatTextureUrl: string

  combatSourceSize: { w: number; h: number }

  /** Texture kiết già tu luyện — undefined thì fallback sang mortal. */
  cultivateTextureKey?: string

  cultivateTextureUrl?: string

  cultivateSourceSize?: { w: number; h: number }

  /**
   * Bảng anchor RIÊNG từng hình thái (vị trí tay/tỷ lệ đạo bào khác
   * nhau) — combat pose.
   */
  bodyAnchors: Record<PlayerBodyAnchorId, NormalizedBodyAnchor>

  /** Anchor cho pose kiết già nếu profile có texture tu luyện riêng. */
  cultivateBodyAnchors?: Record<PlayerBodyAnchorId, NormalizedBodyAnchor>
}

const MORTAL_COMBAT_KEY = 'player-mortal-ink-sword-concept-v2'
const MORTAL_CULTIVATE_KEY = 'player-mortal-cultivate-v1'
const PHAP_TU_COMBAT_KEY = 'player-phap-tu-v1'

/** Anchor mặc định — tư thế đứng đạo bào, chân ở đáy ảnh (foot anchor). */
function standingAnchors(
  overrides?: Partial<Record<PlayerBodyAnchorId, NormalizedBodyAnchor>>,
): Record<PlayerBodyAnchorId, NormalizedBodyAnchor> {
  return {
    head: { x: 0.5, y: 0.11 },
    chest: { x: 0.5, y: 0.36 },
    castHand: { x: 0.66, y: 0.46 },
    offHand: { x: 0.34, y: 0.52 },
    feet: { x: 0.5, y: 0.97 },
    ...overrides,
  }
}

/** Anchor pose kiết già — tay hạ thấp đặt trước danh. */
function lotusAnchors(): Record<PlayerBodyAnchorId, NormalizedBodyAnchor> {
  return {
    head: { x: 0.5, y: 0.13 },
    chest: { x: 0.5, y: 0.38 },
    castHand: { x: 0.6, y: 0.56 },
    offHand: { x: 0.4, y: 0.56 },
    feet: { x: 0.5, y: 0.95 },
  }
}

export const PLAYER_VISUAL_PROFILES: Record<PlayerVisualProfileId, PlayerVisualProfile> = {
  mortal: {
    id: 'mortal',

    combatTextureKey: MORTAL_COMBAT_KEY,
    combatTextureUrl: `/assets/characters/player/mortal/${MORTAL_COMBAT_KEY}.png`,
    combatSourceSize: { w: 1312, h: 1199 },

    cultivateTextureKey: MORTAL_CULTIVATE_KEY,
    cultivateTextureUrl: `/assets/characters/player/mortal/${MORTAL_CULTIVATE_KEY}.png`,
    cultivateSourceSize: { w: 1233, h: 1275 },

    bodyAnchors: standingAnchors({
      // Art thủy mặc cầm kiếm v2: tay kiếm nằm bên trái texture.
      head: { x: 0.55, y: 0.25 },
      chest: { x: 0.55, y: 0.46 },
      castHand: { x: 0.32, y: 0.62 },
      offHand: { x: 0.78, y: 0.47 },
      feet: { x: 0.55, y: 0.96 },
    }),

    cultivateBodyAnchors: lotusAnchors(),
  },

  phap_tu: {
    id: 'phap_tu',

    combatTextureKey: PHAP_TU_COMBAT_KEY,
    combatTextureUrl: `/assets/characters/player/phap-tu/${PHAP_TU_COMBAT_KEY}.png`,
    combatSourceSize: { w: 1293, h: 1216 },

    // Plan §2 — cultivate tạm dùng fallback Phàm Nhân đã thống nhất.
    cultivateTextureKey: MORTAL_CULTIVATE_KEY,
    cultivateTextureUrl: `/assets/characters/player/mortal/${MORTAL_CULTIVATE_KEY}.png`,
    cultivateSourceSize: { w: 1233, h: 1275 },

    // Art Pháp Tu tay tung chú cao hơn và thân áo rộng hơn.
    bodyAnchors: standingAnchors({
      chest: { x: 0.5, y: 0.34 },
      castHand: { x: 0.7, y: 0.4 },
      offHand: { x: 0.31, y: 0.54 },
    }),

    cultivateBodyAnchors: lotusAnchors(),
  },

  kiem_tu: {
    id: 'kiem_tu',

    // Chưa có art riêng — toàn bộ fallback Phàm Nhân (plan §2).
    combatTextureKey: MORTAL_COMBAT_KEY,
    combatTextureUrl: `/assets/characters/player/mortal/${MORTAL_COMBAT_KEY}.png`,
    combatSourceSize: { w: 1312, h: 1199 },

    cultivateTextureKey: MORTAL_CULTIVATE_KEY,
    cultivateTextureUrl: `/assets/characters/player/mortal/${MORTAL_CULTIVATE_KEY}.png`,
    cultivateSourceSize: { w: 1233, h: 1275 },

    bodyAnchors: standingAnchors({
      head: { x: 0.55, y: 0.25 },
      chest: { x: 0.55, y: 0.46 },
      castHand: { x: 0.32, y: 0.62 },
      offHand: { x: 0.78, y: 0.47 },
      feet: { x: 0.55, y: 0.96 },
    }),

    cultivateBodyAnchors: lotusAnchors(),
  },
}

/**
 * Chọn profile theo trạng thái nhân vật (plan §9 unit test #1):
 * - `cultivationPath` quyết định khi đã nhập môn (phap_tu/kiem_tu);
 * - còn Phàm Nhân (không path) hoặc giá trị lạ → `mortal`;
 * - `kiem_tu` trả về profile fallback Phàm Nhân (id giữ nguyên để
 *   caller biết hình thái logic, texture tự trỏ sang mortal).
 */
export function resolvePlayerVisualProfileId(input: {
  realmId?: string

  cultivationPath?: string
}): PlayerVisualProfileId {
  switch (input?.cultivationPath) {
    case 'phap_tu':
      return 'phap_tu'

    case 'kiem_tu':
      return 'kiem_tu'

    default:
      return 'mortal'
  }
}

/** Texture tu luyện hiệu lực — fallback chuỗi về mortal khi profile thiếu. */
export function getCultivateTexture(profile: PlayerVisualProfile): {
  key: string

  sourceSize: { w: number; h: number }
} {
  return {
    key: profile.cultivateTextureKey ?? PLAYER_VISUAL_PROFILES.mortal.cultivateTextureKey!,
    sourceSize: profile.cultivateSourceSize ??
      PLAYER_VISUAL_PROFILES.mortal.cultivateSourceSize!,
  }
}

/** Bảng anchor hiệu lực cho pose đang hiển thị. */
export function getBodyAnchors(
  profile: PlayerVisualProfile,

  pose: 'combat' | 'cultivate',
): Record<PlayerBodyAnchorId, NormalizedBodyAnchor> {
  if (pose === 'cultivate') {
    return (
      profile.cultivateBodyAnchors ?? PLAYER_VISUAL_PROFILES.mortal.cultivateBodyAnchors!
    )
  }

  return profile.bodyAnchors
}
