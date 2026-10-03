// Battlefield region redesign (spec sec6) - hai hop 6x6 (nhan vat/quai)
// chia se hang 3-8, ngan cach bang cot divider trung lap khong ben nao
// duoc chiem. Math ve khoang cach/targeting/AoE KHONG DOI - chi rang buoc
// NOI entity duoc dat.
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

/** Bounding box (hop gioi han) cua ca hai ben + divider - dung cho camera/projection fit, KHONG phai entity placement. */
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
