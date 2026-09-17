// [M13 STATUS: PARTIAL] Mixed liveness module: `areaFor` is live
// (imported by battle/turn/TurnSkillAction); `selectRankedTarget` serves
// the parked ArtifactSystem. The dead Battle-typed helpers
// (isHeroGate/collectAffected/findBattleEnemy) were deleted in Mission G.
// Do not extend the Battle-typed API; new turn-side targeting belongs in
// battle/turn/.
// Combat Grid Rework - primary target + affected area are chosen
// entirely in GRID units (column/row). Pure functions, no state.
//
// stat-system-reimagined Task 3 (D16): the range helpers
// (canPlayerReachTarget / canEnemyReachGate / selectPrimaryTargetForEnemy
// / selectAttackableTarget) were deleted with the retired attackRange
// stat — reach now belongs to action targeting, not Stats.
import type { Battle } from './Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { ActionTargeting, TargetSelectionMode } from './CombatAction'
import {
  GRID_ROW_COUNT,
  GRID_COLUMN_COUNT,
  getCellsInArea,
  entityGridPosition,
  getChebyshevDistance,
  type CellArea,
  type LaneIndex,
} from './BattleGrid'
import { rankTargetsByStrategy, type CombatAiStrategy, DEFAULT_COMBAT_AI_STRATEGY } from './CombatAiStrategy'

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

/**
 * Strategy-ranked target pick over ALL alive materialized enemies
 * (2026-08-26 pre-positioning rule): rank every living enemy by strategy
 * from the avatar's current position, return the first candidate.
 * Survives the attackRange retirement (Task 3, D16) unchanged — this
 * picker never gated on reach. Currently consumed by the dormant
 * ArtifactSystem activation tick.
 */
export function selectRankedTarget(
  battle: Battle,
  strategy: CombatAiStrategy = DEFAULT_COMBAT_AI_STRATEGY,
): CombatEntity | null {
  const player = battle.player

  if (!battle.playerMaterialized || !player.alive) {
    return null
  }

  const candidates = rankTargetsByStrategy(
    battle.enemies
      .filter((battleEnemy) => battleEnemy.entity.alive)
      .map((battleEnemy) => ({
        entity: battleEnemy.entity,
        distance: getChebyshevDistance(
          entityGridPosition(player),
          entityGridPosition(battleEnemy.entity),
        ),
      })),
    strategy,
  )

  return candidates[0]?.entity ?? null
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
      // No single rectangle describes a cross - the turn engine filters
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
