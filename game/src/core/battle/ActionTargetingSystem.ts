// Combat Grid Rework — chọn primary target + thu thập vùng ảnh hưởng
// hoàn toàn theo đơn vị GRID (cột/hàng). Pure functions, không state.
import type { Battle, BattleEnemy } from './Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { ActionTargeting, TargetSelectionMode } from './CombatAction'
import {
  GRID_ROW_COUNT,
  GRID_COLUMN_COUNT,
  VISIBLE_MAX_COLUMN,
  getCellsInArea,
  getColumnFromWorldX,
  type CellArea,
  type LaneIndex,
} from './BattleGrid'

/** Hero là CỔNG chặn ngang mọi hàng — targetable từ bất kỳ row nào. */
export function isHeroGate(entity: CombatEntity, playerId: string): boolean {
  return entity.id === playerId
}

interface Candidate {
  entity: CombatEntity
  columnDistance: number
  laneDistance: number
}

function compareBySelection(a: Candidate, b: Candidate, selection: TargetSelectionMode): number {
  switch (selection) {
    case 'lowest_hp':
      return a.entity.currentHp - b.entity.currentHp
    case 'highest_hp':
      return b.entity.currentHp - a.entity.currentHp
    default:
      // nearest: gần theo CỘT trước, hòa thì gần theo HÀNG.
      return a.columnDistance - b.columnDistance || a.laneDistance - b.laneDistance
  }
}

/**
 * Chọn primary target trong rangeColumns (đơn vị cột) của nguồn.
 * - Nguồn = player → candidates là quái còn sống.
 * - Nguồn = quái → candidate duy nhất là hero (cổng chặn ngang mọi hàng,
 *   decision 2026-08-24) nếu còn sống.
 * - Gate hiển thị: candidate ngoài VISIBLE_MAX_COLUMN không được chọn
 *   (mirror gate cũ "phải thấy mới bắn"), áp cả 2 phía.
 */
export function selectPrimaryTarget(
  battle: Battle,
  source: CombatEntity,
  targeting: ActionTargeting,
): CombatEntity | null {
  const range = targeting.rangeColumns
  const selection: TargetSelectionMode = targeting.selection ?? 'nearest'
  const sourceColumn = source.id === battle.player.id ? battle.player.x : source.x
  const sourceRow = source.row

  const candidates: Candidate[] = []

  if (source.id === battle.player.id) {
    for (const battleEnemy of battle.enemies) {
      const entity = battleEnemy.entity

      if (!entity.alive || entity.x > VISIBLE_MAX_COLUMN) continue

      const columnDistance = Math.abs(entity.x - sourceColumn)

      if (columnDistance > range) continue

      candidates.push({
        entity,
        columnDistance,
        laneDistance: Math.abs(entity.row - sourceRow),
      })
    }
  } else if (battle.player.alive) {
    // Hero gate: luôn trong tầm xét khi khoảng cách tới cột cổng đủ gần.
    const columnDistance = Math.abs(battle.player.x - sourceColumn)

    if (columnDistance <= range && source.x <= VISIBLE_MAX_COLUMN) {
      candidates.push({ entity: battle.player, columnDistance, laneDistance: Math.abs(battle.player.row - sourceRow) })
    }
  }

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((a, b) => compareBySelection(a, b, selection))

  return candidates[0]!.entity
}

export function areaFor(anchorRow: LaneIndex, anchorColumn: number, targeting: ActionTargeting): CellArea | null {
  switch (targeting.shape) {
    case 'single':
      return getCellsInArea({ row: anchorRow, column: anchorColumn }, 0, 0)
    case 'area':
      return getCellsInArea(
        { row: anchorRow, column: anchorColumn },
        targeting.laneRadius ?? 0,
        targeting.columnRadius ?? 0,
      )
    case 'line':
      return { rowStart: anchorRow, rowEnd: anchorRow, colStart: 0, colEnd: GRID_COLUMN_COUNT - 1 }
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
    return battle.player.alive ? [battle.player] : []
  }

  const area = areaFor(anchorRow, anchorColumn, targeting)

  if (!area) {
    return []
  }

  const selection: TargetSelectionMode = targeting.selection ?? 'nearest'

  const affected = battle.enemies
    .filter(enemy => enemy.entity.alive)
    .filter(enemy => {
      const column = getColumnFromWorldX(enemy.entity.x)

      return (
        enemy.entity.row >= area!.rowStart &&
        enemy.entity.row <= area!.rowEnd &&
        column >= area!.colStart &&
        column <= area!.colEnd
      )
    })
    .map(enemy => ({
      entity: enemy.entity,
      columnDistance: Math.abs(getColumnFromWorldX(enemy.entity.x) - anchorColumn),
      laneDistance: Math.abs(enemy.entity.row - anchorRow),
      isPrimary: enemy.entity.id === primaryTargetId,
    }))
    .sort((a, b) => {
      // Primary target LUÔN đứng đầu để giữ ngữ nghĩa "mục tiêu chính".
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
      return compareBySelection(a, b, selection)
    })
    .slice(0, targeting.maxTargets ?? Number.MAX_SAFE_INTEGER)
    .map(entry => entry.entity)

  void anchorColumn
  return affected
}

export function findBattleEnemy(battle: Battle, id: string): BattleEnemy | undefined {
  return battle.enemies.find(entry => entry.entity.id === id)
}
