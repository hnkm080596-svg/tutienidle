import { describe, expect, it } from 'vitest'
import {
  collectAffected,
  selectRankedTarget,
} from './ActionTargetingSystem'
import { rankTargetsByStrategy } from './CombatAiStrategy'
import type { Battle } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { ActionTargeting } from '../battle/CombatAction'
import { GRID_ROW_COUNT } from '../battle/BattleGrid'

// Combat Grid Rework — selection + AOE shapes theo đơn vị GRID.
// Task 3 (D16): the attackRange-gated helpers retired with the stat —
// selectRankedTarget ranks every alive enemy, no reach gate remains.
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

function battleWith(
  player: CombatEntity,
  enemies: CombatEntity[],
  overrides?: Partial<Pick<Battle, 'playerMaterialized'>>,
): Battle {
  return {
    player,
    enemies: enemies.map(e => ({ entity: e })),
    playerMaterialized: true,
    ...overrides,
  } as unknown as Battle
}

const PLAYER = entity('player', 1, 4)

describe('selectRankedTarget (plan §7.2 + sản phẩm 2026-08-26)', () => {
  it('xếp hạng TOÀN BỘ enemy sống theo strategy — không còn gate tầm đánh', () => {
    // Quái ở cột 14 (xa cổng) vẫn là candidate — pre-position ngay cả
    // khi quái còn xa theo cột.
    const marching = entity('march', 14.0, 3)
    const battle = battleWith(PLAYER, [marching])

    expect(selectRankedTarget(battle)?.id).toBe('march')
  })

  it('bỏ qua enemy đã chết', () => {
    const dead = entity('dead', 2.0, 4)
    dead.alive = false
    const alive = entity('alive', 10.0, 6)
    const battle = battleWith(PLAYER, [dead, alive])

    expect(selectRankedTarget(battle)?.id).toBe('alive')
  })

  it('player chưa materialize → không chọn target', () => {
    const inRange = entity('in', 2.0, 4)
    const battle = battleWith(PLAYER, [inRange], { playerMaterialized: false })

    expect(selectRankedTarget(battle)).toBeNull()
  })

  it('AI strategy: boss_first ưu tiên Boss, tie-break theo distance/row/id', () => {
    const normal = entity('normal_2', 2.0, 2)
    const boss = entity('boss_1', 2.0, 6)
    boss.isBoss = true
    const battle = battleWith(PLAYER, [normal, boss])

    expect(selectRankedTarget(battle, 'nearest')?.id).toBe('normal_2')
    expect(selectRankedTarget(battle, 'boss_first')?.id).toBe('boss_1')
    expect(selectRankedTarget(battle, 'lowest_hp')?.id).toBe('normal_2')

    // rankTargetsByStrategy: lowest_hp hòa HP → gần hơn thắng.
    const ranked = rankTargetsByStrategy(
      [
        { entity: normal, distance: 1 },
        { entity: boss, distance: 5 },
      ],
      'lowest_hp',
    )

    expect(ranked[0]?.entity.id).toBe(normal.id)
  })
})

describe('collectAffected — shape theo grid, clamp biên', () => {
  const base: ActionTargeting = { shape: 'square', laneRadius: 1, columnRadius: 1 }

  it("shape 'square': anchor ở GÓC trên-phải (row 0, col 15) — chỉ ô trong grid", () => {
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

  it("shape 'square': anchor góc dưới-trái (row 9, col 0)", () => {
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
      { shape: 'line' },
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
      { shape: 'all_lanes', columnRadius: 1 },
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
      { shape: 'square', laneRadius: 0, columnRadius: 1, maxTargets: 2 },
    )

    expect(affected).toHaveLength(2)
    expect(affected[0]!.id).toBe('primary')
  })
})

describe('collectAffected — new shapes (cross/row/column)', () => {
  it("shape 'cross': includes arm cells, excludes corner cells of the bounding box", () => {
    const armUp = entity('arm-up', 1, 2) // same column (1), 2 rows up from anchor row 4 — in cross arm
    const armRight = entity('arm-right', 3, 4) // same row (4), 2 cols right from anchor col 1 — in cross arm
    const corner = entity('corner', 3, 2) // diagonal from anchor — NOT in cross; a rectangle filter would wrongly include it
    const battle = battleWith(PLAYER, [armUp, armRight, corner])
    const targeting: ActionTargeting = { shape: 'cross', laneRadius: 2, columnRadius: 2 }

    const affected = collectAffected(battle, PLAYER, 'arm-up', 4, 1, targeting)

    expect(affected.map(e => e.id).sort()).toEqual(['arm-right', 'arm-up'])
  })

  it("shape 'row': includes every enemy on the anchor's row regardless of column", () => {
    const sameRowFar = entity('same-row-far', 15, 4)
    const otherRow = entity('other-row', 1, 6)
    const battle = battleWith(PLAYER, [sameRowFar, otherRow])
    const targeting: ActionTargeting = { shape: 'row' }

    const affected = collectAffected(battle, PLAYER, 'same-row-far', 4, 1, targeting)

    expect(affected.map(e => e.id)).toEqual(['same-row-far'])
  })

  it("shape 'column': includes every enemy on the anchor's column regardless of row", () => {
    const sameColFar = entity('same-col-far', 1, 9)
    const otherCol = entity('other-col', 3, 4)
    const battle = battleWith(PLAYER, [sameColFar, otherCol])
    const targeting: ActionTargeting = { shape: 'column' }

    const affected = collectAffected(battle, PLAYER, 'same-col-far', 4, 1, targeting)

    expect(affected.map(e => e.id)).toEqual(['same-col-far'])
  })
})
