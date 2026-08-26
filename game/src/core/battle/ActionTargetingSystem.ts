// Combat Grid Rework — chọn primary target + thu thập vùng ảnh hưởng
// hoàn toàn theo đơn vị GRID (cột/hàng). Pure functions, không state.
//
// Hai semantics khoảng cách RIÊNG BIỆT (plan §6.1) — không được hợp nhất:
// - Player → enemy: Chebyshev quanh avatar, so với player.stats.attackRange.
// - Enemy → cổng Player: chỉ chênh CỘT tới gateColumn, không xét row.
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

/** Hero là CỔNG chặn ngang mọi hàng — targetable từ bất kỳ row nào. */
export function isHeroGate(entity: CombatEntity, playerId: string): boolean {
  return entity.id === playerId
}

/**
 * Khoảng cách tấn công của Player (plan §2.3): Chebyshev giữa ô avatar
 * và ô target. Mục tiêu trong tầm khi `<= player.stats.attackRange`.
 */
export function canPlayerReachTarget(player: CombatEntity, target: CombatEntity): boolean {
  if (!target.alive) {
    return false
  }

  return (
    getChebyshevDistance(entityGridPosition(player), entityGridPosition(target)) <=
    player.stats.attackRange
  )
}

/**
 * Khoảng cách quái tới CỔNG Player (plan §6.1):
 * - KHÔNG xét row avatar;
 * - distance = abs(enemy.x - gateColumn);
 * - so với attackRange của chính quái;
 * - yêu cầu quái đã materialize (nằm trong battle.enemies).
 */
export function canEnemyReachGate(enemy: CombatEntity, gateColumn: number): boolean {
  return Math.abs(enemy.x - gateColumn) <= enemy.stats.attackRange
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
 * Chọn primary target cho NGUỒN QUÁI — candidate duy nhất là Player/cổng:
 * dùng canEnemyReachGate() theo cột, KHÔNG dùng Chebyshev tới avatar row.
 */
export function selectPrimaryTargetForEnemy(battle: Battle, source: CombatEntity): CombatEntity | null {
  if (!battle.playerMaterialized || !battle.player.alive) {
    return null
  }

  if (!canEnemyReachGate(source, battle.player.x)) {
    return null
  }

  return battle.player
}

/**
 * Chọn primary target CHO PLAYER theo AI strategy (plan §7.2 bước 1):
 * candidate là toàn bộ enemy sống/materialized, CHỈ giữ enemy đang trong
 * Chebyshev range của avatar, sắp theo strategy + tie-break deterministic.
 */
export function selectAttackableTarget(
  battle: Battle,
  strategy: CombatAiStrategy = DEFAULT_COMBAT_AI_STRATEGY,
): CombatEntity | null {
  const player = battle.player

  if (!battle.playerMaterialized || !player.alive) {
    return null
  }

  const candidates = rankTargetsByStrategy(
    battle.enemies
      .filter((battleEnemy) => canPlayerReachTarget(player, battleEnemy.entity))
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

/**
 * Teleport target (yêu cầu sản phẩm 2026-08-26) — Player TELE NGAY tới
 * hàng có mục tiêu tốt nhất thay vì đứng đợi quái đi vào tầm: xếp hạng
 * TOÀN BỘ enemy sống theo strategy tại vị trí avatar hiện tại, trả về
 * ứng viên đầu tiên. BattleSystem chỉ gọi khi KHÔNG có target trong tầm
 * và ICD teleport đã hết.
 */
export function selectTeleportTarget(
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
 * - Secondary được phép nằm NGOÀI attack range của Player sau khi
 *   primary hợp lệ đã chọn (plan §6.4) — đó là damage lan từ điểm va chạm.
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
