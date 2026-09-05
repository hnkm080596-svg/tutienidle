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
