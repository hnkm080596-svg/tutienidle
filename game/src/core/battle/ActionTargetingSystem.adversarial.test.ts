import { describe, expect, it } from 'vitest'
import { areaFor } from './ActionTargetingSystem'
import { targetingForSkill } from './CombatAction'
import { GRID_ROW_COUNT, GRID_COLUMN_COUNT } from './BattleGrid'

// QA adversarial probes (2026-09-04 quick review) — AOE Shape Extension.
// The collectAffected probes (INV-AOE-1/2/3/5) retired with that helper in
// Mission G; the live shape-filter consumer is TurnSkillAction.collectTurnTargets.

describe('AOE shape extension adversarial (QA probes)', () => {
  it('INV-AOE-4: areaFor row/line/column trả CellArea đúng chiều', () => {
    const row = areaFor(4, 7, { shape: 'row' })
    const line = areaFor(4, 7, { shape: 'line' })
    const column = areaFor(4, 7, { shape: 'column' })

    expect(row).toEqual(line)
    expect(row).toEqual({
      rowStart: 4, rowEnd: 4, colStart: 0, colEnd: GRID_COLUMN_COUNT - 1,
    })
    expect(column).toEqual({
      rowStart: 0, rowEnd: GRID_ROW_COUNT - 1, colStart: 7, colEnd: 7,
    })
  })

  it('INV-AOE-6: targetingForSkill fallback trả square, không còn area', () => {
    const result = targetingForSkill({ target: 'enemy', laneRadius: 1, columnRadius: 1 })
    expect(result.shape).toBe('square')
  })
})
