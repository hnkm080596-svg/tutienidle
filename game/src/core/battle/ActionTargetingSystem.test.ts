import { describe, expect, it } from 'vitest'
import { selectPrimaryTarget, collectAffected } from './ActionTargetingSystem'
import type { Battle } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { ActionTargeting } from '../battle/CombatAction'
import { GRID_ROW_COUNT } from '../battle/BattleGrid'

// Combat Grid Rework — selection + AOE shapes theo đơn vị GRID.
function entity(id: string, x: number, row: number, hp = 100): CombatEntity {
  return {
    id,
    name: id,
    x,
    row: row as never,
    currentHp: hp,
    maxHp: 100,
    alive: true,
  } as unknown as CombatEntity
}

function battleWith(player: CombatEntity, enemies: CombatEntity[]): Battle {
  return {
    player,
    enemies: enemies.map(e => ({ entity: e })),
  } as unknown as Battle
}

const PLAYER = entity('player', 0, 4)

describe('selectPrimaryTarget', () => {
  const targeting: ActionTargeting = { rangeColumns: 8, shape: 'single' }

  it('player source: chọn quái GẦN NHẤT theo cột, hòa thì gần hàng hơn', () => {
    const e1 = entity('e1', 6, 0)
    const e2 = entity('e2', 5, 9)
    const battle = battleWith(PLAYER, [e1, e2])

    expect(selectPrimaryTarget(battle, PLAYER, targeting)?.id).toBe('e2')
  })

  it('loại quái ngoài rangeColumns và ngoài màn hình (x > VISIBLE)', () => {
    const far = entity('far', 12, 2) // 12 > range 8
    const offscreen = entity('off', 16, 2)
    const near = entity('near', 3, 2)
    const battle = battleWith(PLAYER, [far, offscreen, near])

    expect(selectPrimaryTarget(battle, PLAYER, targeting)?.id).toBe('near')
  })

  it('selection lowest_hp / highest_hp bỏ qua khoảng cách', () => {
    const a = entity('a', 4, 2, 80)
    const b = entity('b', 6, 2, 30)
    const battle = battleWith(PLAYER, [a, b])

    const lowest = selectPrimaryTarget(battle, PLAYER, { ...targeting, selection: 'lowest_hp' })
    const highest = selectPrimaryTarget(battle, PLAYER, { ...targeting, selection: 'highest_hp' })

    expect(lowest?.id).toBe('b')
    expect(highest?.id).toBe('a')
  })

  it('enemy source: candidate DUY NHẤT là hero (cổng chặn ngang mọi hàng)', () => {
    const enemy = entity('enemy', 10, 7)
    const battle = battleWith(PLAYER, [])

    // Range 10 ≥ dist 10 ✓ → target là player.
    expect(selectPrimaryTarget(battle, enemy, { rangeColumns: 10, shape: 'single' })?.id).toBe('player')

    // Range ngắn hơn khoảng cách → không target.
    expect(selectPrimaryTarget(battle, enemy, { rangeColumns: 5, shape: 'single' })).toBeNull()
  })
})

describe('collectAffected — shape theo grid, clamp biên', () => {
  const base: ActionTargeting = { rangeColumns: 99, shape: 'area', laneRadius: 1, columnRadius: 1 }

  it("shape 'area': anchor ở GÓC trên-phải (row 0, col 15) — chỉ ô trong grid", () => {
    const inCell = entity('in', 14.6, 1) // col 15, row 1
    const outRow = entity('outRow', 14.2, 3) // row 3 > 0+1
    const outCol = entity('outCol', 11.2, 0) // col 11 < 15-1
    const primary = entity('primary', 15.4, 0)

    const affected = collectAffected(
      battleWith(PLAYER, [inCell, outRow, outCol, primary]),
      PLAYER,
      'primary',
      0,
      15,
      base,
    )

    expect(affected.map(e => e.id).sort()).toEqual(['in', 'primary'])
  })

  it("shape 'area': anchor góc dưới-trái (row 9, col 0)", () => {
    const inCell = entity('in', 0.2, 9)
    const outAbove = entity('outAbove', 0.4, 7)
    const primary = entity('primary', 1.4, 9)

    const affected = collectAffected(
      battleWith(PLAYER, [inCell, outAbove, primary]),
      PLAYER,
      'primary',
      (GRID_ROW_COUNT - 1) as never,
      0,
      base,
    )

    expect(affected.map(e => e.id)).toEqual(['primary', 'in'])
  })

  it("shape 'line': toàn bộ HÀNG của primary, các hàng khác không trúng", () => {
    const sameRowFar = entity('sameRowFar', 15.2, 2)
    const otherRowNear = entity('otherRowNear', 5.2, 3)
    const primary = entity('primary', 4.8, 2)

    const affected = collectAffected(
      battleWith(PLAYER, [sameRowFar, otherRowNear, primary]),
      PLAYER,
      'primary',
      2,
      5,
      { rangeColumns: 99, shape: 'line' },
    )

    // Primary LUÔN đứng đầu affected (sort isPrimary-first).
    expect(affected.map(e => e.id)).toEqual(['primary', 'sameRowFar'])
  })

  it("shape 'all_lanes': dải cột ± columnRadius phủ MỌI hàng", () => {
    const topRow = entity('top', 5.2, 0)
    const bottomRow = entity('bottom', 5.4, 9)
    const outsideBand = entity('outside', 8.4, 0)
    const primary = entity('primary', 5.0, 2)

    const affected = collectAffected(
      battleWith(PLAYER, [topRow, bottomRow, outsideBand, primary]),
      PLAYER,
      'primary',
      2,
      5,
      { rangeColumns: 99, shape: 'all_lanes', columnRadius: 1 },
    )

    expect(affected.map(e => e.id)).toEqual(['primary', 'top', 'bottom'])
  })

  it('maxTargets: cắt nhưng primary luôn được giữ', () => {
    const primary = entity('primary', 5.4, 2, 50)
    const e1 = entity('e1', 5.6, 2, 90)
    const e2 = entity('e2', 5.8, 2, 80)

    const affected = collectAffected(
      battleWith(PLAYER, [primary, e1, e2]),
      PLAYER,
      'primary',
      2,
      5,
      { rangeColumns: 99, shape: 'area', laneRadius: 0, columnRadius: 1, maxTargets: 2 },
    )

    expect(affected).toHaveLength(2)
    expect(affected[0]!.id).toBe('primary')
  })
})
