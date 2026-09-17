import { describe, expect, it } from 'vitest'
import { selectRankedTarget } from './ActionTargetingSystem'
import { rankTargetsByStrategy } from './CombatAiStrategy'
import type { Battle } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'

// Combat Grid Rework - selection in GRID units.
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
