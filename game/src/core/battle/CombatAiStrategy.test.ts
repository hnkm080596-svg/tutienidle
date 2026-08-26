import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COMBAT_AI_STRATEGY,
  COMBAT_AI_STRATEGIES,
  isCombatAiStrategy,
  rankTargetsByStrategy,
  chebyshevDistanceToEnemy,
  type RankedTarget,
} from './CombatAiStrategy'
import { entityGridPosition, getChebyshevDistance } from './BattleGrid'
import type { CombatEntity } from '../combat/CombatEntity'

// AI target strategy (plan §2.7/§7.1): đủ năm strategy, tie-break
// deterministic theo distance → row → column → id, validator dùng chung
// cho core/UI/save.
function enemy(
  id: string,
  row: number,
  column: number,
  overrides: Partial<Pick<CombatEntity, 'currentHp' | 'isBoss' | 'isElite'>> = {},
): CombatEntity {
  return {
    id,
    x: column,
    row: row as never,
    currentHp: overrides.currentHp ?? 100,
    isBoss: overrides.isBoss,
    isElite: overrides.isElite,
  } as unknown as CombatEntity
}

function ranked(...entities: CombatEntity[]): RankedTarget[] {
  return entities.map((entity) => ({
    entity,
    distance: chebyshevDistanceToEnemy({ x: 1, row: 4 }, entity),
  }))
}

describe('CombatAiStrategy — validator', () => {
  it('chấp nhận đúng năm giá trị, từ chối missing/sai kiểu/giá trị lạ', () => {
    expect(DEFAULT_COMBAT_AI_STRATEGY).toBe('nearest')
    expect(COMBAT_AI_STRATEGIES).toHaveLength(5)

    for (const strategy of COMBAT_AI_STRATEGIES) {
      expect(isCombatAiStrategy(strategy)).toBe(true)
    }

    expect(isCombatAiStrategy(undefined)).toBe(false)
    expect(isCombatAiStrategy(null)).toBe(false)
    expect(isCombatAiStrategy(42)).toBe(false)
    expect(isCombatAiStrategy('aggressive')).toBe(false)
  })
})

describe('rankTargetsByStrategy — quy tắc chính', () => {
  const near = enemy('near', 4, 2)
  const far = enemy('far', 0, 8)

  it('nearest: Chebyshev nhỏ nhất trước', () => {
    const result = rankTargetsByStrategy(ranked(far, near), 'nearest')

    expect(result[0]!.entity.id).toBe('near')
  })

  it('boss_first: Boss trước dù xa hơn, sau đó mới tới khoảng cách', () => {
    const bossFar = enemy('boss_far', 9, 9, { isBoss: true })

    const result = rankTargetsByStrategy(ranked(near, bossFar), 'boss_first')

    expect(result.map((entry) => entry.entity.id)).toEqual(['boss_far', 'near'])
  })

  it('elite_first: Boss → Elite → thường, trong cùng nhóm so khoảng cách', () => {
    const normal = enemy('normal', 4, 2)
    const elite = enemy('elite', 5, 2, { isElite: true })
    const boss = enemy('boss', 6, 2, { isBoss: true })

    const result = rankTargetsByStrategy(ranked(normal, elite, boss), 'elite_first')

    expect(result.map((entry) => entry.entity.id)).toEqual(['boss', 'elite', 'normal'])
  })

  it('lowest_hp / highest_hp theo currentHp, hòa thì gần hơn thắng', () => {
    const woundedNear = enemy('wounded_near', 4, 2, { currentHp: 30 })
    const woundedFar = enemy('wounded_far', 0, 8, { currentHp: 30 })
    const healthy = enemy('healthy', 4, 3, { currentHp: 90 })

    const lowest = rankTargetsByStrategy(ranked(woundedFar, woundedNear, healthy), 'lowest_hp')

    // Hòa HP 30 → tie-break distance: gần hơn trước.
    expect(lowest[0]!.entity.id).toBe('wounded_near')

    const highest = rankTargetsByStrategy(ranked(woundedNear, healthy), 'highest_hp')

    expect(highest[0]!.entity.id).toBe('healthy')
  })
})

describe('rankTargetsByStrategy — tie-break deterministic bắt buộc (plan §2.7)', () => {
  it('cùng quy tắc chính + cùng distance → row tăng dần rồi column tăng dần rồi id chuỗi', () => {
    // Cùng distance 1 từ avatar (4,1): các ô kề Chebyshev.
    const b = enemy('b', 3, 2)
    const a = enemy('a', 3, 0)
    const c = enemy('c', 5, 2)

    const result = rankTargetsByStrategy(ranked(b, a, c), 'nearest')

    // distance: a=(|−1|,1)=1? col 0 dist |0−1|=1, row 3 diff 1 → 1;
    // b=(row −1=1, col 1)=1; c=(1,1)=1 → hòa toàn bộ → row asc: a,b (row 3)
    // trước c (row 5); cùng row 3 → column asc: a (col 0) trước b (col 2).
    expect(result.map((entry) => entry.entity.id)).toEqual(['a', 'b', 'c'])
  })

  it('id là tie-break cuối cùng khi trùng cả row/column (overlap hợp lệ)', () => {
    const second = enemy('mob_2', 4, 2)
    const first = enemy('mob_1', 4, 2)

    const result = rankTargetsByStrategy(ranked(second, first), 'nearest')

    expect(result.map((entry) => entry.entity.id)).toEqual(['mob_1', 'mob_2'])
  })
})

describe('Chebyshev helpers (plan §2.3/§4.1)', () => {
  it('cùng ô = 0; ngang/dọc/chéo 1 ô = 1; chéo 2 ô = 2', () => {
    const origin = { row: 4 as const, column: 5 }

    expect(getChebyshevDistance(origin, origin)).toBe(0)
    expect(getChebyshevDistance(origin, { row: 4, column: 6 })).toBe(1)
    expect(getChebyshevDistance(origin, { row: 5, column: 5 })).toBe(1)
    expect(getChebyshevDistance(origin, { row: 5, column: 6 })).toBe(1)
    expect(getChebyshevDistance(origin, { row: 6, column: 7 })).toBe(2)
  })

  it('entityGridPosition làm tròn world-x qua getColumnFromWorldX', () => {
    expect(entityGridPosition({ x: 2.4, row: 3 })).toEqual({ row: 3, column: 2 })
    expect(entityGridPosition({ x: 2.6, row: 7 })).toEqual({ row: 7, column: 3 })
  })
})
