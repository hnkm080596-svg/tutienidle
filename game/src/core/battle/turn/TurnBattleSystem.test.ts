import { describe, expect, it } from 'vitest'
import { selectTarget, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'

// Fixture giống hệt quy ước đã dùng trong ActionTargetingSystem.test.ts —
// selectTarget chỉ đọc id/x/row/alive, không cần Stats đầy đủ.
function entity(id: string, column: number, row: number, alive = true): CombatEntity {
  return {
    id,
    x: column,
    row: row as never,
    alive,
  } as unknown as CombatEntity
}

function participant(
  id: string,
  combatEntity: CombatEntity,
  speed = 10,
  priority = 0,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive }
}

describe('selectTarget', () => {
  it('cùng hàng: chọn entity gần nhất theo cột', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const near = participant('near', entity('near', 2, 4))
    const far = participant('far', entity('far', 5, 4))

    expect(selectTarget(actor, [far, near])?.id).toBe('near')
  })

  it('không có ai cùng hàng: chọn gần nhất theo Chebyshev toàn bàn cờ', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const otherRowNear = participant('otherRowNear', entity('otherRowNear', 1, 5))
    const otherRowFar = participant('otherRowFar', entity('otherRowFar', 8, 8))

    expect(selectTarget(actor, [otherRowFar, otherRowNear])?.id).toBe('otherRowNear')
  })

  it('bỏ qua entity đã chết', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const dead = participant('dead', entity('dead', 1, 4, false))
    const alive = participant('alive', entity('alive', 3, 4))

    expect(selectTarget(actor, [dead, alive])?.id).toBe('alive')
  })

  it('toàn bộ phe đối diện đã chết: trả về undefined', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const dead = participant('dead', entity('dead', 1, 4, false))

    expect(selectTarget(actor, [dead])).toBeUndefined()
  })
})
