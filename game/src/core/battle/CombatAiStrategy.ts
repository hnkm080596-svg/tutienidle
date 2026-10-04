// CombatAiStrategy (plan sec7) - chien luoc AI chon muc tieu cua Player,
// dung chung cho core (BattleSystem targeting/teleport), UI (Combat AI
// panel) va save (PlayerData.combatAiStrategy). Comparator THUAN, tie-break
// deterministic bat buoc:
//   1. Quy tac chinh cua strategy
//   2. Chebyshev distance tai vi tri avatar hien tai
//   3. Row tang dan
//   4. Column tang dan
//   5. Entity ID theo thu tu chuoi
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

/** Validator dung chung save/UI - gia tri sai/thieu -> fallback default. */
export function isCombatAiStrategy(value: unknown): value is CombatAiStrategy {
  return typeof value === 'string' && COMBAT_AI_STRATEGIES.includes(value as CombatAiStrategy)
}

export interface RankedTarget {
  entity: CombatEntity

  /** Chebyshev distance tu avatar Player toi target tai thoi diem cham diem. */
  distance: number
}

function rankKey(target: RankedTarget): string {
  const position = entityGridPosition(target.entity)

  return `${position.row}:${position.column}:${target.entity.id}`
}

/**
 * Sap candidate theo strategy + tie-break deterministic bat buoc
 * (plan sec2.7): quy tac chinh -> Chebyshev distance -> row tang dan ->
 * column tang dan -> entity id chuoi.
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

    // Tie-break con lai: distance -> row -> column -> id.
    const byDistance = a.distance - b.distance

    if (byDistance !== 0) {
      return byDistance
    }

    return keys.get(a)!.localeCompare(keys.get(b)!)
  })
}

/**
 * Diem Chebyshev tu avatar Player toi 1 enemy - DUNG CHUNG cho ca ranking
 * lan teleport simulation de khong co noi nao tu tinh khoang cach rieng.
 */
export function chebyshevDistanceToEnemy(
  player: Pick<CombatEntity, 'x' | 'row'>,
  enemy: CombatEntity,
): number {
  return getChebyshevDistance(entityGridPosition(player), entityGridPosition(enemy))
}
