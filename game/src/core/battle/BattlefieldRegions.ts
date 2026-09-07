// Battlefield region redesign (spec §6) — hai hộp 6×6 (nhân vật/quái)
// chia sẻ hàng 3-8, ngăn cách bằng cột divider trung lập không bên nào
// được chiếm. Math về khoảng cách/targeting/AoE KHÔNG ĐỔI — chỉ ràng buộc
// NƠI entity được đặt.
import type { GridPosition, LaneIndex } from './BattleGrid'

export interface BattlefieldUsableRegion {
  rowMin: LaneIndex
  rowMax: LaneIndex
  columnMin: number
  columnMax: number
}

const BATTLEFIELD_ROW_RANGE = { rowMin: 3 as LaneIndex, rowMax: 8 as LaneIndex }

export const PLAYER_SIDE_REGION: BattlefieldUsableRegion = {
  ...BATTLEFIELD_ROW_RANGE,
  columnMin: 0,
  columnMax: 5,
}

export const NEUTRAL_DIVIDER_COLUMN = 6

export const ENEMY_SIDE_REGION: BattlefieldUsableRegion = {
  ...BATTLEFIELD_ROW_RANGE,
  columnMin: 7,
  columnMax: 12,
}

/** Bounding box (hộp giới hạn) của cả hai bên + divider — dùng cho camera/projection fit, KHÔNG phải entity placement. */
export const DEFAULT_BATTLEFIELD_USABLE_REGION: BattlefieldUsableRegion = {
  ...BATTLEFIELD_ROW_RANGE,
  columnMin: 0,
  columnMax: 12,
}

export function centerOfRegion(region: BattlefieldUsableRegion): GridPosition {
  return {
    row: Math.floor((region.rowMin + region.rowMax) / 2) as LaneIndex,
    column: Math.floor((region.columnMin + region.columnMax) / 2),
  }
}

export const STANDING_SLOT_COUNT = 3

// Merge each old 2x2 block into one standing slot, anchored at the first
// physical row/column of the pair (offsets 0, 2, 4 across a 6-wide
// region). Distance/AOE math is untouched -- it only ever consumes the
// resolved GridPosition, same as it already does via
// resolvePartyFormation()/resolveEnemySpawnPosition().
export function standingSlotPosition(
  region: BattlefieldUsableRegion,
  slotRow: number,
  slotColumn: number,
): GridPosition {
  return {
    row: (region.rowMin + slotRow * 2) as LaneIndex,
    column: region.columnMin + slotColumn * 2,
  }
}
