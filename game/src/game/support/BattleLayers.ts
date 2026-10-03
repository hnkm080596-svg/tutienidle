// Render layers 2.5D (2026-08-24) - hang so depth cho toan bo GameObject
// trong CombatScene, tach dung 7 lop theo plan:
//
//   background      -> bau troi/nui/mat dat hoi tu (BattlefieldBackdrop.ts)
//   ground/grid     -> luoi lane chieu phoi canh, ve lai moi layout
//   ground VFX      -> decal, vong phep, telegraph AOE - NAM TREN MAT DAT
//   entity shadow   -> bong ellipse duoi chan, LUON duoi moi sprite
//   entity sprite   -> nhan vat, sort theo projected Y (gan de xa)
//   upright/air VFX -> slash/explosion/hit flash - DUNG THANG GIO
//   overlay/UI      -> label, HP bar, cast bar, DOT icon, so damage bay
//
// Entity sprite dung dai depth [BASE .. BASE+SPAN) de sort theo chieu sau
// ma khong tran sang lop upright VFX. Thu tu sort: projected Y (trong so
// lon) -> column -> hash(entityId) - 2 tie-breaker sau chong nhap nhay khi
// 2 unit cung hang/doc theo duong chan.
//
// QUAN TRONG (migration gate P2): depth la HE TOA DO ON DINH theo vi tri
// tren san - min/max foot Y truyen vao PHAI la bien co dinh cua mat duong
// (projection.bounds()), KHONG phai tap entity dang song. Spawn/death cua
// 1 entity khong duoc lam remap depth cua entity khac, va upright VFX
// (depth chot luc spawn) luon cung thuoc voi entity trong suot timeline.
//
// Background sub-layers (2026-08-26) - art modular Thanh Van KHONG dung
// chung mot depth nua (insertion order khien atmosphere de len battle
// ground). Thu tu bat buoc:
//
//   sky < far mountains < midground < atmosphere < battle ground
//       < foreground left/right < time grading
//
// => dung quan he "foreground > battle ground > atmosphere", va moi depth
// background van NHO HON DEPTH_GROUND_GRID (=100).
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
/** Dai danh cho Y-sort cua entity sprite; phai < khoang cach toi lop ke. */
export const DEPTH_ENTITY_SPRITE_SPAN = 100
export const DEPTH_UPRIGHT_VFX = 600
export const DEPTH_OVERLAY_UI = 800

import { GRID_COLUMN_COUNT } from '@/core/battle/BattleGrid'

/** Trong so tuong doi Y : column : id = 90 : 9 : 1. */
const Y_WEIGHT = 0.9
const COLUMN_WEIGHT = 0.09
const ID_WEIGHT = 0.0099

/** Dai tri toi da cua ID tie-breaker: hash < 1 => tie-break < 0.99. */
export const ID_TIE_BREAKER_MAX = ID_WEIGHT * DEPTH_ENTITY_SPRITE_SPAN

/**
 * Bias upright VFX - PHAI lon hon toan bo dai ID tie-breaker (0.99) de
 * dam bao effect CUNG o LUON phu target bat ke hash cua 2 key; van nho
 * hon khoang cach depth giua 2 hang (~9 depth/r hang) nen entity
 * foreground VAN che duoc effect o hang sau (giu occlusion 2.5D).
 */
export const UPRIGHT_VFX_DEPTH_BIAS = ID_TIE_BREAKER_MAX + 0.01

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** FNV-1a 32-bit - deterministic, khong can luu state them vao entity. */
function stableIdHash(entityId: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < entityId.length; index++) {
    hash ^= entityId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0) / 4294967296
}

/**
 * Thanh phan KHONG GIAN cua depth - chi phu thuoc vi tri tren san
 * (projected Y quyet dinh chinh, column phu). Ham thuan, dung chung cho
 * entity sprite va upright VFX de 2 he luon cung mot thuoc do.
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

/** Tie-breaker deterministic theo entityId - chi pha hoa, khong lat thu tu. */
function idTieBreaker(entityId: string): number {
  return stableIdHash(entityId) * ID_TIE_BREAKER_MAX
}

/**
 * Depth cho 1 entity sprite: spatial depth + tie-breaker theo id (chong
 * flicker khi 2 unit cung hang - Y cua 2 unit khac hang chenh >= nua cell
 * nen tie-breaker KHONG bao gio lat nguoc thu tu dung).
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
 * Depth cho upright VFX tai 1 foot point: spatial depth + bias LON HON
 * toan bo dai tie-breaker => effect cung o luon phu target (khong phu thuoc
 * may rui hash), entity foreground van che duoc effect hang sau.
 */
export function uprightVfxDepth(
  footY: number,
  minFootY: number,
  maxFootY: number,
  column: number,
): number {
  return spatialEntityDepth(footY, minFootY, maxFootY, column) + UPRIGHT_VFX_DEPTH_BIAS
}
