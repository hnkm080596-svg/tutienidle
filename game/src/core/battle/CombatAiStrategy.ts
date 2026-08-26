// CombatAiStrategy (plan §7) — chiến lược AI chọn mục tiêu của Player,
// dùng chung cho core (BattleSystem targeting/teleport), UI (Combat AI
// panel) và save (PlayerData.combatAiStrategy). Comparator THUẦN, tie-break
// deterministic bắt buộc:
//   1. Quy tắc chính của strategy
//   2. Chebyshev distance tại vị trí avatar hiện tại
//   3. Row tăng dần
//   4. Column tăng dần
//   5. Entity ID theo thứ tự chuỗi
import type { CombatEntity } from '../combat/CombatEntity'
import { entityGridPosition, getChebyshevDistance } from './BattleGrid'

export type CombatAiStrategy =
  | 'nearest'
  | 'boss_first'
  | 'elite_first'
  | 'lowest_hp'
  | 'highest_hp'

export const DEFAULT_COMBAT_AI_STRATEGY: CombatAiStrategy = 'nearest'

export const COMBAT_AI_STRATEGIES: readonly CombatAiStrategy[] = [
  'nearest',
  'boss_first',
  'elite_first',
  'lowest_hp',
  'highest_hp',
]

/** Validator dùng chung save/UI — giá trị sai/thiếu → fallback default. */
export function isCombatAiStrategy(value: unknown): value is CombatAiStrategy {
  return typeof value === 'string' && COMBAT_AI_STRATEGIES.includes(value as CombatAiStrategy)
}

export interface RankedTarget {
  entity: CombatEntity

  /** Chebyshev distance từ avatar Player tới target tại thời điểm chấm điểm. */
  distance: number
}

function rankKey(target: RankedTarget): string {
  const position = entityGridPosition(target.entity)

  return `${position.row}:${position.column}:${target.entity.id}`
}

/**
 * Sắp candidate theo strategy + tie-break deterministic bắt buộc
 * (plan §2.7): quy tắc chính → Chebyshev distance → row tăng dần →
 * column tăng dần → entity id chuỗi.
 */
export function rankTargetsByStrategy(
  candidates: RankedTarget[],
  strategy: CombatAiStrategy,
): RankedTarget[] {
  const keys = new Map<RankedTarget, string>()

  for (const candidate of candidates) {
    keys.set(candidate, rankKey(candidate))
  }

  const byPrimary = (a: RankedTarget, b: RankedTarget): number => {
    switch (strategy) {
      case 'nearest':
        return a.distance - b.distance
      case 'lowest_hp':
        return a.entity.currentHp - b.entity.currentHp || a.distance - b.distance
      case 'highest_hp':
        return b.entity.currentHp - a.entity.currentHp || a.distance - b.distance
      case 'boss_first':
      case 'elite_first': {
        const priority = (entity: CombatEntity): number =>
          entity.isBoss ? 0 : (strategy === 'elite_first' && entity.isElite ? 1 : 2)

        return priority(a.entity) - priority(b.entity) || a.distance - b.distance
      }
    }
  }

  return [...candidates].sort((a, b) => {
    const primary = byPrimary(a, b)

    if (primary !== 0) {
      return primary
    }

    // Tie-break còn lại: distance → row → column → id.
    const byDistance = a.distance - b.distance

    if (byDistance !== 0) {
      return byDistance
    }

    return keys.get(a)!.localeCompare(keys.get(b)!)
  })
}

/**
 * Điểm Chebyshev từ avatar Player tới 1 enemy — DÙNG CHUNG cho cả ranking
 * lẫn teleport simulation để không có nơi nào tự tính khoảng cách riêng.
 */
export function chebyshevDistanceToEnemy(
  player: Pick<CombatEntity, 'x' | 'row'>,
  enemy: CombatEntity,
): number {
  return getChebyshevDistance(entityGridPosition(player), entityGridPosition(enemy))
}
