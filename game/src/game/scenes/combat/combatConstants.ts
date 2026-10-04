// combatConstants (ui-discoverability-refactor-plan.md sec3.2) - hang so
// dung chung cho cac combat module tach tu CombatScene.ts. Refactor thuan
// - KHONG doi gia tri nao.
import { HERO_COLUMN, HERO_LANE_INDEX } from '@/core/battle/BattleLane'

export const PLAYER_ID = 'player'
export { HERO_COLUMN, HERO_LANE_INDEX }

export const HIT_RECOIL_PX = 6
export const HIT_RECOIL_DURATION_MS = 65

// Turn-ready emphasis: forward lean on the shared offsetX impulse channel
// (replaces the old boost scale punch). Duration is one leg of the yoyo -
// the full out-and-back beat stays at the tuned 2 x 250 ms.
export const TURN_READY_LEAN_PX = 8
export const TURN_READY_LEAN_MS = 250

/** DoT text flush 3 lan/giay (plan sec7.2) - cua so gom 333,33ms. */
export const DOT_TEXT_FLUSH_INTERVAL_MS = 1000 / 3

export const HIT_FLASH_COLOR = 0xff6b6b
export const CRITICAL_FLASH_COLOR = 0xffffff

// Nay so sat thuong (spec CombatUIredesign muc 10) - do cho sat thuong
// NHAN vao (target la player), trang cho sat thuong GAY RA (target la
// quai), vang rieng cho don Chi Mang bat ke chieu.
export const DAMAGE_DEALT_COLOR = '#f4f4f0'
export const DAMAGE_TAKEN_COLOR = '#ff6b6b'
export const CRITICAL_DAMAGE_COLOR = '#ffd54f'

// 6A (2026-09-01) - floating kill/heal (spec sec2).
export const KILL_TEXT_COLOR = '#f4f4f0'
export const KILL_TEXT_STROKE = '#c94b4b'
export const HEAL_TEXT_COLOR = '#7bd88f'

// 6A-T4 (2026-09-01) - PlayerHudLayer (in-canvas HUD, spec sec2): HP do
// dong bo enemy fill, MP xanh muc (derivation --ink family), Kiem gold
// dong bo boss fill; bg/stroke theo enemy HP pattern.
export const PLAYER_HUD_BG_COLOR = 0x241b1b
export const PLAYER_HUD_STROKE_COLOR = 0x241b1b
export const PLAYER_HUD_HP_COLOR = 0xc94b4b
export const PLAYER_HUD_MP_COLOR = 0x4a90d9
export const PLAYER_HUD_KIEM_COLOR = 0xd4a72c
// Task 16 - The bar (Phap Tu): violet derivation, armed tint brighter
// once the pool reaches the empowerment threshold.
export const PLAYER_HUD_THE_COLOR = 0x9b6dd7
export const PLAYER_HUD_THE_ARMED_COLOR = 0xc9a7f5
// The Tu Reimagined (T22) - Son Nhac Ho The external-ward layer: pale
// jade shield tone, visually distinct from HP (crimson) and The (violet).
export const PLAYER_HUD_WARD_COLOR = 0x7ec8a9
export const PLAYER_HUD_LABEL_COLOR = '#f4f4f0'
export const PLAYER_HUD_LABEL_COLOR_INT = 0xf4f4f0

// M13: cast-bar creation path retired with the 'cast'/'cast_start'
// producers - only OFFSET_Y remains, used by positionCastBar cleanup.
export const CAST_BAR_OFFSET_Y = 10

export const ENEMY_HP_BG_COLOR = 0x241b1b
export const ENEMY_HP_FILL_COLOR = 0xc94b4b
export const BOSS_HP_FILL_COLOR = 0xd4a72c
export const ENEMY_HP_BAR_HEIGHT = 6
export const ENEMY_HP_BAR_OFFSET_Y = 12

// Buff bar (2026-09-02) - icon row tren unit: enemy duoi foot,
// player tren cum sub-bar HUD. Floating text attach mau theo polarity.
export const STATUS_ICON_SIZE = 10
export const STATUS_ICON_SPACING = 4
export const STATUS_ROW_GAP = 4
export const STATUS_MAX_PER_ROW = 8
export const STATUS_FOOT_ROW_OFFSET_Y = 8
export const STATUS_PLAYER_ROW_OFFSET_Y = 6
export const BUFF_ATTACH_COLOR = '#7bd88f'
export const DEBUFF_ATTACH_COLOR = '#ff6b6b'

// Grid projection 2.5D (combat-grid-view) - palette grid lines/border,
// copy nguyen gia tri tu CombatScene.ts const declarations.
export const LANE_DIVIDER_COLOR = 0x2a2d38
export const PERSPECTIVE_GRID_COLOR = 0x8a94ad
export const PERSPECTIVE_GRID_ALPHA = 0.14
export const PERSPECTIVE_BORDER_COLOR = 0xaeb9d4
export const PERSPECTIVE_BORDER_ALPHA = 0.3

export const PLAYER_COLOR = 0x4a90d9
export const ENEMY_COLOR = 0xd94a4a

export const PLAYER_DISPLAY_SCALE_MULTIPLIER = 2
export const ENEMY_DISPLAY_SCALE_MULTIPLIER = 2

// Boss to gap 2 lan mot enemy THUONG (2026-09-05, Combat Art Pipeline spec
// sec7 addendum) - thay doi co chu dich so voi hanh vi cu "boss dung CUNG
// multiplier x2 nhu enemy thuong" (xem CombatScene.enemyScale.test.ts).
export const BOSS_DISPLAY_SCALE_MULTIPLIER = ENEMY_DISPLAY_SCALE_MULTIPLIER * 2

export const SHADOW_COLOR = 0x000000
export const SHADOW_ALPHA = 0.32
export const SHADOW_WIDTH_RATIO = 1.12
export const SHADOW_HEIGHT_RATIO = 0.34

export const CHARACTER_HEIGHT_RATIO = 0.7
export const CHARACTER_WIDTH_RATIO = 0.45

// San thoi luong 1 doan noi suy - tranh chia gan 0 neu 2 lan cap nhat vi
// tri lien tiep toi qua sat nhau (combat-position-interpolation).
export const MIN_SEGMENT_DURATION_MS = 16

// Tran thoi luong 1 doan noi suy - snapshot tre nhat van ve target trong
// khung nay, tranh mot doan noi suy dai bat thuong.
export const MAX_SEGMENT_DURATION_MS = 200
