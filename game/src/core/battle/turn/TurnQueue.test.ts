import { describe, expect, it } from 'vitest'
import { resolveNextTurn, type TurnQueueActor } from './TurnQueue'

function makeActor(id: string, speed: number, priority: number): TurnQueueActor {
  return { id, speed, priority, actionGauge: 0, alive: true }
}

describe('TurnQueue.resolveNextTurn', () => {
  it('actor speed cao nhất luôn đến lượt trước tính từ 0', () => {
    const fast = makeActor('fast', 20, 0)
    const slow = makeActor('slow', 5, 1)
    const result = resolveNextTurn([fast, slow])
    expect(result?.actor.id).toBe('fast')
  })

  it('tie-break: speed bằng nhau thì priority thấp hơn đi trước', () => {
    const a = makeActor('a', 10, 1)
    const b = makeActor('b', 10, 0)
    const result = resolveNextTurn([a, b])
    expect(result?.actor.id).toBe('b')
  })

  it('actor đã chết bị loại khỏi hàng đợi', () => {
    const dead = makeActor('dead', 999, 0)
    dead.alive = false
    const alive = makeActor('alive', 1, 1)
    const result = resolveNextTurn([dead, alive])
    expect(result?.actor.id).toBe('alive')
  })

  it('mảng rỗng hoặc toàn bộ đã chết trả về null', () => {
    const dead = makeActor('dead', 10, 0)
    dead.alive = false
    expect(resolveNextTurn([dead])).toBeNull()
    expect(resolveNextTurn([])).toBeNull()
  })

  it('gauge của actor thắng lượt được tính đúng theo speed * steps', () => {
    const actor = makeActor('a', 100, 0)
    const result = resolveNextTurn([actor])
    expect(result?.actor.actionGauge).toBe((result?.steps ?? 0) * 100)
  })
})
