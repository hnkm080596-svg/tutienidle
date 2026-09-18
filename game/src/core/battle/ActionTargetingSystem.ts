// [M13 STATUS: PARTIAL] `areaFor` is live (imported by
// battle/turn/TurnSkillAction). The dead Battle-typed helpers
// (isHeroGate/collectAffected/findBattleEnemy) were deleted in Mission G;
// `selectRankedTarget` + the `Battle` type retired at buff2 M5 with the
// parked ArtifactSystem/legacy buff package. New turn-side targeting
// belongs in battle/turn/.
// Combat Grid Rework — chọn primary target + vùng ảnh hưởng hoàn toàn
// theo đơn vị GRID (cột/hàng). Pure functions, không state.
//
// stat-system-reimagined Task 3 (D16): the range helpers
// (canPlayerReachTarget / canEnemyReachGate / selectPrimaryTargetForEnemy
// / selectAttackableTarget) were deleted with the retired attackRange
// stat — reach now belongs to action targeting, not Stats.
import type { CombatEntity } from '../combat/CombatEntity'
import type { ActionTargeting, TargetSelectionMode } from './CombatAction'
import {
  GRID_ROW_COUNT,
  GRID_COLUMN_COUNT,
  getCellsInArea,
  type CellArea,
  type LaneIndex,
} from './BattleGrid'

interface Candidate {
  entity: CombatEntity
  columnDistance: number
}

function compareBySelection(a: Candidate, b: Candidate, selection: TargetSelectionMode): number {
  switch (selection) {
    case 'lowest_hp':
      return a.entity.currentHp - b.entity.currentHp
    case 'highest_hp':
      return b.entity.currentHp - a.entity.currentHp
    default:
      // nearest: gần theo CỘT trước, hòa thì theo thứ tự danh sách ổn định.
      return a.columnDistance - b.columnDistance
  }
}

export function areaFor(anchorRow: LaneIndex, anchorColumn: number, targeting: ActionTargeting): CellArea | null {
  switch (targeting.shape) {
    case 'single':
      return getCellsInArea({ row: anchorRow, column: anchorColumn }, 0, 0)
    case 'square':
      return getCellsInArea(
        { row: anchorRow, column: anchorColumn },
        targeting.laneRadius ?? 0,
        targeting.columnRadius ?? 0,
      )
    case 'cross':
      // No single rectangle describes a cross — the turn engine filters
      // per-cell via isCellInShape() instead of using this bounding area.
      return null
    case 'line':
      return { rowStart: anchorRow, rowEnd: anchorRow, colStart: 0, colEnd: GRID_COLUMN_COUNT - 1 }
    case 'row':
      return { rowStart: anchorRow, rowEnd: anchorRow, colStart: 0, colEnd: GRID_COLUMN_COUNT - 1 }
    case 'column':
      return { rowStart: 0, rowEnd: GRID_ROW_COUNT - 1, colStart: anchorColumn, colEnd: anchorColumn }
    case 'all_lanes':
      return getCellsInArea(
        { row: anchorRow, column: anchorColumn },
        GRID_ROW_COUNT,
        targeting.columnRadius ?? 1,
      )
  }
}
