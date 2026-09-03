import { describe, expect, it } from 'vitest'
import { collectAffected, areaFor } from './ActionTargetingSystem'
import { targetingForSkill } from './CombatAction'
import type { Battle } from './Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { ActionTargeting } from './CombatAction'
import { GRID_ROW_COUNT, GRID_COLUMN_COUNT } from './BattleGrid'

// QA adversarial probes (2026-09-04 quick review) — AOE Shape Extension.

function entity(id: string, x: number, row: number, hp = 100): CombatEntity {
  return {
    id,
    name: id,
    x,
    row: row as never,
    currentHp: hp,
    maxHp: 100,
    alive: true,
    stats: { attackRange: 2 },
  } as unknown as CombatEntity
}

function battleWith(player: CombatEntity, enemies: CombatEntity[]): Battle {
  return {
    player,
    enemies: enemies.map(e => ({ entity: e })),
    playerMaterialized: true,
  } as unknown as Battle
}

const PLAYER = entity('player', 1, 4)

describe('AOE shape extension adversarial (QA probes)', () => {
  it('INV-AOE-1: cross KHÔNG rơi vào nhánh !area — arm cells vẫn được thu', () => {
    const armUp = entity('arm-up', 1, 2)
    const armRight = entity('arm-right', 3, 4)
    const battle = battleWith(PLAYER, [armUp, armRight])
    const targeting: ActionTargeting = { shape: 'cross', laneRadius: 2, columnRadius: 2 }

    const affected = collectAffected(battle, PLAYER, 'arm-up', 4, 1, targeting)
    expect(affected.map(e => e.id).sort()).toEqual(['arm-right', 'arm-up'])
  })

  it('INV-AOE-2: primary luôn đứng đầu với shape cross', () => {
    const primary = entity('primary', 1, 3) // arm up 1
    const other = entity('other', 1, 5) // arm down 1
    const battle = battleWith(PLAYER, [other, primary])
    const targeting: ActionTargeting = { shape: 'cross', laneRadius: 2 }

    const affected = collectAffected(battle, PLAYER, 'primary', 4, 1, targeting)
    expect(affected[0]?.id).toBe('primary')
  })

  it('INV-AOE-3: cross + maxTargets=1 vẫn giữ primary', () => {
    const primary = entity('primary', 1, 3)
    const other = entity('other', 1, 5)
    const battle = battleWith(PLAYER, [other, primary])
    const targeting: ActionTargeting = { shape: 'cross', laneRadius: 2, maxTargets: 1 }

    const affected = collectAffected(battle, PLAYER, 'primary', 4, 1, targeting)
    expect(affected).toHaveLength(1)
    expect(affected[0]?.id).toBe('primary')
  })

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

  it('INV-AOE-5: parity — square radius 1×1 = hành vi area cũ (rectangle clamp)', () => {
    // 'square' phải giữ nguyên rectangle logic của 'area' cũ: góc grid clamp.
    const inCell = entity('in', 14.6, 1)
    const outRow = entity('outRow', 14.2, 3)
    const primary = entity('primary', 15.4, 0)
    const battle = battleWith(PLAYER, [inCell, outRow, primary])

    const affected = collectAffected(
      battle,
      PLAYER,
      'primary',
      0,
      15,
      { shape: 'square', laneRadius: 1, columnRadius: 1 },
    )

    expect(affected.map(e => e.id).sort()).toEqual(['in', 'primary'])
  })

  it('INV-AOE-6: targetingForSkill fallback trả square, không còn area', () => {
    const result = targetingForSkill({ target: 'enemy', laneRadius: 1, columnRadius: 1 })
    expect(result.shape).toBe('square')
  })
})
