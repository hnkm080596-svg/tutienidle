import { describe, expect, it } from 'vitest'
import { VfxPool } from './VfxPool'

function poolFixture(capacity = 2) {
  let created = 0
  const destroyed: number[] = []
  const pool = new VfxPool(capacity, () => ({ id: ++created, alpha: 1 }),
    value => { value.alpha = 0 }, value => { destroyed.push(value.id) })
  return { pool, destroyed }
}
describe('scene VFX pool', () => {
  it('bounds allocation and resets released objects before reusing them', () => {
    const { pool } = poolFixture()
    const first = pool.acquire()!
    const second = pool.acquire()!
    expect(pool.acquire()).toBeNull()
    first.value.alpha = 0.8
    first.release()
    const reused = pool.acquire()!
    expect(reused.value.id).toBe(first.value.id)
    expect(reused.value.alpha).toBe(0)
    expect(pool.stats).toEqual({ allocated: 2, active: 2, capacity: 2 })
    first.release()
    expect(pool.stats.active).toBe(2)
    second.release()
    reused.release()
    expect(pool.stats.active).toBe(0)
  })
  it('invalidates old leases on reset and destroys each allocation once', () => {
    const { pool, destroyed } = poolFixture()
    const old = pool.acquire()!
    pool.reset()
    const current = pool.acquire()!
    old.release()
    expect(pool.stats.active).toBe(1)
    pool.destroy()
    current.release()
    pool.destroy()
    expect(destroyed).toEqual([1])
    expect(pool.acquire()).toBeNull()
    expect(pool.stats.active).toBe(0)
  })
  it('never recycles an object whose reset failed', () => {
    let id = 0
    const disposed: number[] = []
    const pool = new VfxPool(1, () => ++id, () => { throw new Error('reset failed') },
      value => { disposed.push(value) })
    const lease = pool.acquire()!
    expect(() => lease.release()).toThrow('reset failed')
    expect(disposed).toEqual([1])
    expect(pool.acquire()!.value).toBe(2)
  })
})
