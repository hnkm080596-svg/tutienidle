// Render layers 2.5D (2026-08-24) — hằng số depth cho toàn bộ GameObject
// trong CombatScene, tách đúng 7 lớp theo plan:
//
//   background      → bầu trời/núi/mặt đất hội tụ (BattlefieldBackdrop.ts)
//   ground/grid     → lưới lane chiếu phối cảnh, vẽ lại mỗi layout
//   ground VFX      → decal, vòng phép, telegraph AOE — NẰM TRÊN MẶT ĐẤT
//   entity shadow   → bóng ellipse dưới chân, LUÔN dưới mọi sprite
//   entity sprite   → nhân vật, sort theo projected Y (gần đè xa)
//   upright/air VFX → slash/explosion/hit flash — ĐỨNG THĂNG GIÓ
//   overlay/UI      → label, HP bar, cast bar, DOT icon, số damage bay
//
// Entity sprite dùng dải depth [BASE .. BASE+SPAN) để sort theo chiều sâu
// mà không tràn sang lớp upright VFX. Thứ tự sort: projected Y (trọng số
// lớn) → column → hash(entityId) — 2 tie-breaker sau chống nhấp nháy khi
// 2 unit cùng hàng/dọc theo đường chân.
//
// QUAN TRỌNG (migration gate P2): depth là HỆ TỌA ĐỘ ỔN ĐỊNH theo vị trí
// trên sân — min/max foot Y truyền vào PHẢI là biên cố định của mặt đường
// (projection.bounds()), KHÔNG phải tập entity đang sống. Spawn/death của
// 1 entity không được làm remap depth của entity khác, và upright VFX
// (depth chốt lúc spawn) luôn cùng thước với entity trong suốt timeline.
//
// Background sub-layers (2026-08-26) — art modular Thanh Vân KHÔNG dùng
// chung một depth nữa (insertion order khiến atmosphere đè lên battle
// ground). Thứ tự bắt buộc:
//
//   sky < far mountains < midground < atmosphere < battle ground
//       < foreground left/right < time grading
//
// ⇒ đúng quan hệ "foreground > battle ground > atmosphere", và mọi depth
// background vẫn NHỎ HƠN DEPTH_GROUND_GRID (=100).
export const DEPTH_BACKGROUND = 0
export const DEPTH_BACKGROUND_SKY = DEPTH_BACKGROUND + 1
export const DEPTH_BACKGROUND_FAR_MOUNTAINS = DEPTH_BACKGROUND_SKY + 1
export const DEPTH_BACKGROUND_MIDGROUND = DEPTH_BACKGROUND_FAR_MOUNTAINS + 1
export const DEPTH_BACKGROUND_ATMOSPHERE = DEPTH_BACKGROUND_MIDGROUND + 1
export const DEPTH_BACKGROUND_BATTLE_GROUND = DEPTH_BACKGROUND_ATMOSPHERE + 1
export const DEPTH_BACKGROUND_FOREGROUND = DEPTH_BACKGROUND_BATTLE_GROUND + 1
export const DEPTH_THANH_VAN_TIME_GRADE = DEPTH_BACKGROUND_FOREGROUND + 1
export const DEPTH_GROUND_GRID = 100
export const DEPTH_GROUND_VFX = 200
export const DEPTH_ENTITY_SHADOW = 300
export const DEPTH_ENTITY_SPRITE_BASE = 400
/** Dải dành cho Y-sort của entity sprite; phải < khoảng cách tới lớp kế. */
export const DEPTH_ENTITY_SPRITE_SPAN = 100
export const DEPTH_UPRIGHT_VFX = 600
export const DEPTH_OVERLAY_UI = 800

import { GRID_COLUMN_COUNT } from '@/core/battle/BattleGrid'

/** Trọng số tương đối Y : column : id = 90 : 9 : 1. */
const Y_WEIGHT = 0.9
const COLUMN_WEIGHT = 0.09
const ID_WEIGHT = 0.0099

/** Dải trị tối đa của ID tie-breaker: hash < 1 ⇒ tie-break < 0.99. */
export const ID_TIE_BREAKER_MAX = ID_WEIGHT * DEPTH_ENTITY_SPRITE_SPAN

/**
 * Bias upright VFX — PHẢI lớn hơn toàn bộ dải ID tie-breaker (0.99) để
 * đảm bảo effect CÙNG ô LUÔN phủ target bất kể hash của 2 key; vẫn nhỏ
 * hơn khoảng cách depth giữa 2 hàng (~9 depth/r hàng) nên entity
 * foreground VẪN che được effect ở hàng sau (giữ occlusion 2.5D).
 */
export const UPRIGHT_VFX_DEPTH_BIAS = ID_TIE_BREAKER_MAX + 0.01

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** FNV-1a 32-bit — deterministic, không cần lưu state thêm vào entity. */
function stableIdHash(entityId: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < entityId.length; index++) {
    hash ^= entityId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0) / 4294967296
}

/**
 * Thành phần KHÔNG GIAN của depth — chỉ phụ thuộc vị trí trên sân
 * (projected Y quyết định chính, column phụ). Hàm thuần, dùng chung cho
 * entity sprite và upright VFX để 2 hệ luôn cùng một thước đo.
 */
export function spatialEntityDepth(
  footY: number,
  minFootY: number,
  maxFootY: number,
  column: number,
): number {
  const normalizedY = maxFootY > minFootY ? clamp01((footY - minFootY) / (maxFootY - minFootY)) : 0
  const normalizedColumn = clamp01(column / Math.max(1, GRID_COLUMN_COUNT - 1))

  return (
    DEPTH_ENTITY_SPRITE_BASE +
    normalizedY * DEPTH_ENTITY_SPRITE_SPAN * Y_WEIGHT +
    normalizedColumn * DEPTH_ENTITY_SPRITE_SPAN * COLUMN_WEIGHT
  )
}

/** Tie-breaker deterministic theo entityId — chỉ phá hòa, không lật thứ tự. */
function idTieBreaker(entityId: string): number {
  return stableIdHash(entityId) * ID_TIE_BREAKER_MAX
}

/**
 * Depth cho 1 entity sprite: spatial depth + tie-breaker theo id (chống
 * flicker khi 2 unit cùng hàng — Y của 2 unit khác hàng chênh ≥ nửa cell
 * nên tie-breaker KHÔNG bao giờ lật ngược thứ tự đúng).
 */
export function entitySpriteDepth(
  footY: number,
  minFootY: number,
  maxFootY: number,
  column: number,
  entityId: string,
): number {
  return spatialEntityDepth(footY, minFootY, maxFootY, column) + idTieBreaker(entityId)
}

/**
 * Depth cho upright VFX tại 1 foot point: spatial depth + bias LỚN HƠN
 * toàn bộ dải tie-breaker ⇒ effect cùng ô luôn phủ target (không phụ thuộc
 * may rủi hash), entity foreground vẫn che được effect hàng sau.
 */
export function uprightVfxDepth(
  footY: number,
  minFootY: number,
  maxFootY: number,
  column: number,
): number {
  return spatialEntityDepth(footY, minFootY, maxFootY, column) + UPRIGHT_VFX_DEPTH_BIAS
}
