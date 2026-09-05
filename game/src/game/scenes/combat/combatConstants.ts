// combatConstants (ui-discoverability-refactor-plan.md §3.2) — hằng số
// dùng chung cho các combat module tách từ CombatScene.ts. Refactor thuần
// — KHÔNG đổi giá trị nào.
import { HERO_COLUMN, HERO_LANE_INDEX } from '@/core/battle/BattleLane'

export const PLAYER_ID = 'player'
export { HERO_COLUMN, HERO_LANE_INDEX }

export const HIT_RECOIL_PX = 6
export const ATTACK_LUNGE_PX = 8
export const ATTACK_LUNGE_DURATION_MS = 75
export const HIT_RECOIL_DURATION_MS = 65

/** DoT text flush 3 lần/giây (plan §7.2) — cửa sổ gom 333,33ms. */
export const DOT_TEXT_FLUSH_INTERVAL_MS = 1000 / 3

export const HIT_FLASH_COLOR = 0xff6b6b
export const CRITICAL_FLASH_COLOR = 0xffffff

// Nảy số sát thương (spec CombatUIredesign mục 10) — đỏ cho sát thương
// NHẬN vào (target là player), trắng cho sát thương GÂY RA (target là
// quái), vàng riêng cho đòn Chí Mạng bất kể chiều.
export const DAMAGE_DEALT_COLOR = '#f4f4f0'
export const DAMAGE_TAKEN_COLOR = '#ff6b6b'
export const CRITICAL_DAMAGE_COLOR = '#ffd54f'

// 6A (2026-09-01) — floating kill/heal (spec §2).
export const KILL_TEXT_COLOR = '#f4f4f0'
export const KILL_TEXT_STROKE = '#c94b4b'
export const HEAL_TEXT_COLOR = '#7bd88f'

// 6A-T4 (2026-09-01) — PlayerHudLayer (in-canvas HUD, spec §2): HP đỏ
// đồng bộ enemy fill, MP xanh mực (derivation --ink family), Kiếm gold
// đồng bộ boss fill; bg/stroke theo enemy HP pattern.
export const PLAYER_HUD_BG_COLOR = 0x241b1b
export const PLAYER_HUD_STROKE_COLOR = 0x241b1b
export const PLAYER_HUD_HP_COLOR = 0xc94b4b
export const PLAYER_HUD_MP_COLOR = 0x4a90d9
export const PLAYER_HUD_KIEM_COLOR = 0xd4a72c
export const PLAYER_HUD_LABEL_COLOR = '#f4f4f0'

export const CAST_GLOW_COLOR = 0xffffff

// Cast Time (2026-08-21) — cast bar hiện phía TRÊN đầu unit.
export const CAST_BAR_BG_COLOR = 0x1c1712
export const CAST_BAR_FILL_COLOR = 0xf4c542
export const CAST_BAR_HEIGHT = 5
export const CAST_BAR_OFFSET_Y = 10
export const CAST_NAME_COLOR = '#f4c542'

export const ENEMY_HP_BG_COLOR = 0x241b1b
export const ENEMY_HP_FILL_COLOR = 0xc94b4b
export const BOSS_HP_FILL_COLOR = 0xd4a72c
export const ENEMY_HP_BAR_HEIGHT = 6
export const ENEMY_HP_BAR_OFFSET_Y = 12

// Buff bar (2026-09-02) — icon row trên unit: enemy dưới foot,
// player trên cụm sub-bar HUD. Floating text attach màu theo polarity.
export const STATUS_ICON_SIZE = 10
export const STATUS_ICON_SPACING = 4
export const STATUS_ROW_GAP = 4
export const STATUS_MAX_PER_ROW = 8
export const STATUS_FOOT_ROW_OFFSET_Y = 8
export const STATUS_PLAYER_ROW_OFFSET_Y = 6
export const BUFF_ATTACH_COLOR = '#7bd88f'
export const DEBUFF_ATTACH_COLOR = '#ff6b6b'

// Grid projection 2.5D (combat-grid-view) — palette grid lines/border,
// copy nguyên giá trị từ CombatScene.ts const declarations.
export const LANE_DIVIDER_COLOR = 0x2a2d38
export const PERSPECTIVE_GRID_COLOR = 0x8a94ad
export const PERSPECTIVE_GRID_ALPHA = 0.14
export const PERSPECTIVE_BORDER_COLOR = 0xaeb9d4
export const PERSPECTIVE_BORDER_ALPHA = 0.3

export const PLAYER_COLOR = 0x4a90d9
export const ENEMY_COLOR = 0xd94a4a

export const PLAYER_DISPLAY_SCALE_MULTIPLIER = 2
export const ENEMY_DISPLAY_SCALE_MULTIPLIER = 2

// Boss to gấp 2 lần một enemy THƯỜNG (2026-09-05, Combat Art Pipeline spec
// §7 addendum) — thay đổi có chủ đích so với hành vi cũ "boss dùng CÙNG
// multiplier ×2 như enemy thường" (xem CombatScene.enemyScale.test.ts).
export const BOSS_DISPLAY_SCALE_MULTIPLIER = ENEMY_DISPLAY_SCALE_MULTIPLIER * 2

export const SHADOW_COLOR = 0x000000
export const SHADOW_ALPHA = 0.32
export const SHADOW_WIDTH_RATIO = 1.12
export const SHADOW_HEIGHT_RATIO = 0.34

export const ENEMY_NEUTRAL_BODY_ANCHOR = { x: 0.5, y: 0.4 } as const

export const CHARACTER_HEIGHT_RATIO = 0.7
export const CHARACTER_WIDTH_RATIO = 0.45

// Sàn thời lượng 1 đoạn nội suy — tránh chia gần 0 nếu 2 lần cập nhật vị
// trí liên tiếp tới quá sát nhau (combat-position-interpolation).
export const MIN_SEGMENT_DURATION_MS = 16
