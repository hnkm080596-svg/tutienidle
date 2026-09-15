// [M13 STATUS: PARTIAL] Mixed liveness module: `areaFor` is live
// (imported by battle/turn/TurnSkillAction); the Battle-typed helpers
// (selectRankedTarget, collectAffected, findBattleEnemy) serve only the
// dormant ArtifactSystem and tests now that EnemyAttackSystem and
// SkillEffectResolver are retired (M13). Do not extend the
// Battle-typed API; new turn-side targeting belongs in battle/turn/.
// Combat Grid Rework — chọn primary target + thu thập vùng ảnh hưởng
// hoàn toàn theo đơn vị GRID (cột/hàng). Pure functions, không state.
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
  getColumnFromWorldX,
  type CellArea,
  type LaneIndex,
} from './BattleGrid'
import { rankTargetsByStrategy, type CombatAiStrategy, DEFAULT_COMBAT_AI_STRATEGY } from './CombatAiStrategy'
import { isCellInShape, type AoeShapeSpec } from './turn/AoeShape'

/** Hero là CỔNG chặn ngang mọi hàng — targetable từ bất kỳ row nào. */
export function isHeroGate(entity: CombatEntity, playerId: string): boolean {
  return entity.id === playerId
}

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
      // No single rectangle describes a cross — collectAffected() filters
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

/**
 * Thu thập entity nằm trong vùng ảnh hưởng của action tại anchor.
 * - Nguồn quái: hero là mục tiêu duy nhất có thể bị action trúng
 *   (chưa có enemy AOE friendly-fire trong thiết kế hiện tại).
 * - Secondary được phép nằm NGOÀI vùng chứa primary sau khi primary
 *   hợp lệ đã chọn (plan §6.4) — đó là damage lan từ điểm va chạm.
 * - maxTargets: cắt sau khi sort theo cùng selection metric.
 */
export function collectAffected(
  battle: Battle,
  source: CombatEntity,
  primaryTargetId: string,
  anchorRow: LaneIndex,
  anchorColumn: number,
  targeting: ActionTargeting,
): CombatEntity[] {
  if (source.id !== battle.player.id) {
    return battle.player.alive && battle.playerMaterialized ? [battle.player] : []
  }

  const selection: TargetSelectionMode = targeting.selection ?? 'nearest'

  const isInRange = (row: LaneIndex, column: number): boolean => {
    if (targeting.shape === 'cross') {
      const spec: AoeShapeSpec = { shape: 'cross', radius: targeting.laneRadius ?? 0 }
      return isCellInShape(
        { row: anchorRow, column: anchorColumn },
        spec,
        { row, column },
      )
    }

    const area = areaFor(anchorRow, anchorColumn, targeting)
    if (!area) {
      return false
    }
    return row >= area.rowStart && row <= area.rowEnd && column >= area.colStart && column <= area.colEnd
  }

  const affected = battle.enemies
    .filter(enemy => enemy.entity.alive)
    .filter(enemy => isInRange(enemy.entity.row, getColumnFromWorldX(enemy.entity.x)))
    .map(enemy => ({
      entity: enemy.entity,
      columnDistance: Math.abs(getColumnFromWorldX(enemy.entity.x) - anchorColumn),
      isPrimary: enemy.entity.id === primaryTargetId,
    }))
    .sort((a, b) => {
      // Primary target LUÔN đứng đầu để giữ ngữ nghĩa "mục tiêu chính".
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
      return compareBySelection(a, b, selection)
    })
    .slice(0, targeting.maxTargets ?? Number.MAX_SAFE_INTEGER)
    .map(entry => entry.entity)

  return affected
}

export function findBattleEnemy(battle: Battle, id: string): Battle['enemies'][number] | undefined {
  return battle.enemies.find(entry => entry.entity.id === id)
}
