// PlayerVisualProfiles (player-body-anchor-reward-gourd-plan §4.1) —
// catalog hình ảnh Player theo hình thái: texture combat, texture tu
// luyện và bảng body anchor chuẩn hoá (tỷ lệ 0..1 của ảnh nguồn).
//
// Policy hình thái (plan §2):
// - `mortal`: art Phàm Nhân mới (combat + kiết già tu luyện).
// - `phap_tu`: art Pháp Tu mới trong combat; tu luyện tạm dùng fallback
//   Phàm Nhân đã thống nhất.
// - `kiem_tu`: CHƯA có art riêng — fallback toàn bộ sang Phàm Nhân.
// - `the_tu`: NO dedicated art yet - falls back entirely to mortal.
//
// Scenes chỉ nhận PROFILE ID (không cầm Player store/GameManager) qua
// Phaser registry + event `player_visual_profile_changed`.
//
// 2026-09-14 — the id type + resolution rule moved to
// `core/player/PlayerVisualForm.ts`: the visual form is entity domain data,
// derived once (player store getter `visualProfileId`) for every place the
// character appears. Re-exports kept so existing importers stay unchanged.
export type { PlayerVisualProfileId } from '@/core/player/PlayerVisualForm'
export { resolvePlayerVisualProfileId } from '@/core/player/PlayerVisualForm'

import type { PlayerVisualProfileId } from '@/core/player/PlayerVisualForm'
import type { CultivationWayId } from '@/core/player/CultivationPathKit'
import type { ArtExtent } from '@/presentation/art/CombatEntityPresentation'
import { isBetaWay } from '@/core/betaScope'

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

// Reskin-matched statics (art-seam wave, user ruling Q4 2026-09-29): one
// entity = one art family - the profile PNG is the armed variant's roster
// portrait, not a separate concept piece.
const MORTAL_COMBAT_KEY = 'player-mortal-pham-nhan-v1'
// Minh hand-drawn cultivate v2 (2026-09-27) replaces the v1 placeholder.
const MORTAL_CULTIVATE_KEY = 'player-mortal-cultivate-v2'
const PHAP_TU_COMBAT_KEY = 'player-phap-tu-ngu-hanh-v1'
const PHAP_TU_CULTIVATE_KEY = 'player-phap-tu-cultivate-ngu-hanh-v1'
const KIEM_TU_COMBAT_KEY = 'player-kiem-tu-v1'
const KIEM_TU_CULTIVATE_KEY = 'player-kiem-tu-cultivate-v1'

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
    combatSourceSize: { w: 744, h: 744 },

    cultivateTextureKey: MORTAL_CULTIVATE_KEY,
    cultivateTextureUrl: `/assets/characters/player/mortal/${MORTAL_CULTIVATE_KEY}.png`,
    cultivateSourceSize: { w: 1254, h: 1254 },

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
    combatSourceSize: { w: 732, h: 756 },

    // Minh hand-drawn Ngũ Hành cultivate (2026-09-27). Pháp Tu Ẩn
    // (Vạn Đạo) has a dedicated PNG on disk but no profile id - the
    // hidden ways collapse into 'phap_tu' before art lookup.
    cultivateTextureKey: PHAP_TU_CULTIVATE_KEY,
    cultivateTextureUrl: `/assets/characters/player/phap-tu/${PHAP_TU_CULTIVATE_KEY}.png`,
    cultivateSourceSize: { w: 1254, h: 1254 },

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

    // Minh hand-drawn Ngự Kiếm set (2026-09-27): static frame extracted
    // from the idle sheet for non-combat surfaces; combat itself runs the
    // 'ngu_kiem' animated variant via CHARACTER_RESKIN_MAP.
    combatTextureKey: KIEM_TU_COMBAT_KEY,
    combatTextureUrl: `/assets/characters/player/kiem-tu/${KIEM_TU_COMBAT_KEY}.png`,
    combatSourceSize: { w: 744, h: 744 },

    cultivateTextureKey: KIEM_TU_CULTIVATE_KEY,
    cultivateTextureUrl: `/assets/characters/player/kiem-tu/${KIEM_TU_CULTIVATE_KEY}.png`,
    cultivateSourceSize: { w: 1312, h: 1199 },

    bodyAnchors: standingAnchors({
      head: { x: 0.5, y: 0.1 },
      chest: { x: 0.5, y: 0.35 },
      castHand: { x: 0.68, y: 0.45 },
      offHand: { x: 0.32, y: 0.5 },
      feet: { x: 0.5, y: 0.96 },
    }),

    cultivateBodyAnchors: lotusAnchors(),
  },

  the_tu: {
    id: 'the_tu',

    // No dedicated art yet - everything falls back to mortal (same policy
    // as kiem_tu; the_tu art is future content).
    combatTextureKey: MORTAL_COMBAT_KEY,
    combatTextureUrl: `/assets/characters/player/mortal/${MORTAL_COMBAT_KEY}.png`,
    combatSourceSize: { w: 744, h: 744 },

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
 * Hidden-way cultivate art (user ruling Q3, 2026-09-29): keyed by
 * CultivationWayId so the pick survives the way->profile collapse
 * (phap_tu_an merged into phap_tu). An override wins over the profile's
 * own cultivate texture; the extent is the PNG's measured alpha bbox.
 */
export const CULTIVATE_TEXTURE_OVERRIDES: Partial<
  Record<
    CultivationWayId,
    {
      key: string
      url: string
      sourceSize: { w: number; h: number }
      extent: ArtExtent
    }
  >
> = {
  hidden_spell_pathway: {
    key: 'player-phap-tu-an-cultivate-van-dao-v1',
    url: '/assets/characters/player/phap-tu/player-phap-tu-an-cultivate-van-dao-v1.png',
    sourceSize: { w: 1254, h: 1254 },
    extent: { x: 0, y: 0.039075, w: 1, h: 0.960925 },
  },
}

/** Texture tu luyện hiệu lực — hidden-way override first, then fallback chuỗi về mortal khi profile thiếu. */
export function getCultivateTexture(
  profile: PlayerVisualProfile,
  way?: CultivationWayId,
): {
  key: string
  url: string
  sourceSize: { w: number; h: number }
} {
  const mortal = PLAYER_VISUAL_PROFILES.mortal

  // BETA SCOPE LOCK - a carried way_out_of_scope save keeps its way
  // record but must not repaint the live cultivate figure: non-beta
  // ways collapse to mortal BEFORE the profile lookup, so a dormant
  // profile id can never reach its dedicated art.
  if (way !== undefined && !isBetaWay(way)) {
    return {
      key: mortal.cultivateTextureKey!,
      url: mortal.cultivateTextureUrl!,
      sourceSize: { ...mortal.cultivateSourceSize! },
    }
  }

  // The override catalog only carries hidden-way art.
  const override = way !== undefined ? CULTIVATE_TEXTURE_OVERRIDES[way] : undefined

  if (override) {
    return { key: override.key, url: override.url, sourceSize: { ...override.sourceSize } }
  }

  return {
    key: profile.cultivateTextureKey ?? mortal.cultivateTextureKey!,
    url: profile.cultivateTextureUrl ?? mortal.cultivateTextureUrl!,
    sourceSize: profile.cultivateSourceSize ?? mortal.cultivateSourceSize!,
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
