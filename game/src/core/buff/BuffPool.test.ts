import { describe, it, expect, beforeEach } from 'vitest'
import { BuffPool } from './BuffPool'
import type { Buff } from './Buff'

function makeBuff(overrides: Partial<Buff> = {}): Buff {
  return {
    id: 'test_buff', sourceId: 'source_1', targetId: 'target_1',
    polarity: 'debuff', duration: 5, remainingTime: 5, stacks: 1,
    stackMode: 'refresh', continuousSeconds: 0, effects: [],
    ...overrides,
  }
}

describe('BuffPool', () => {
  let pool: BuffPool

  beforeEach(() => {
    pool = new BuffPool()
  })

  it('getFromSource returns the exact (id, sourceId) instance', () => {
    pool.add(makeBuff({ sourceId: 'a' }))
    pool.add(makeBuff({ sourceId: 'b' }))

    expect(pool.getFromSource('test_buff', 'a')?.sourceId).toBe('a')
    expect(pool.getFromSource('test_buff', 'b')?.sourceId).toBe('b')
    expect(pool.getFromSource('test_buff', 'c')).toBeUndefined()
  })

  it('getAllById returns every source instance of one id', () => {
    pool.add(makeBuff({ sourceId: 'a' }))
    pool.add(makeBuff({ sourceId: 'b' }))
    pool.add(makeBuff({ id: 'other', sourceId: 'a' }))

    expect(pool.getAllById('test_buff')).toHaveLength(2)
    expect(pool.getAllById('other')).toHaveLength(1)
  })

  it('two sources applying the same id coexist as separate instances', () => {
    pool.add(makeBuff({ sourceId: 'a', stacks: 1 }))
    pool.add(makeBuff({ sourceId: 'b', stacks: 3 }))

    expect(pool.getFromSource('test_buff', 'a')?.stacks).toBe(1)
    expect(pool.getFromSource('test_buff', 'b')?.stacks).toBe(3)
  })

  it('removeInstance only removes the (id, sourceId) match, not other sources', () => {
    pool.add(makeBuff({ sourceId: 'a' }))
    pool.add(makeBuff({ sourceId: 'b' }))

    pool.removeInstance('test_buff', 'a')

    expect(pool.getFromSource('test_buff', 'a')).toBeUndefined()
    expect(pool.getFromSource('test_buff', 'b')).toBeDefined()
  })

  it('removeAllById removes every source instance of one id', () => {
    pool.add(makeBuff({ sourceId: 'a' }))
    pool.add(makeBuff({ sourceId: 'b' }))
    pool.add(makeBuff({ id: 'other', sourceId: 'a' }))

    pool.removeAllById('test_buff')

    expect(pool.getAllById('test_buff')).toHaveLength(0)
    expect(pool.getAllById('other')).toHaveLength(1)
  })

  it('hasAny is true if any source has the id', () => {
    expect(pool.hasAny('test_buff')).toBe(false)
    pool.add(makeBuff())
    expect(pool.hasAny('test_buff')).toBe(true)
  })

  it('getAll returns every instance across every id and source', () => {
    pool.add(makeBuff({ sourceId: 'a' }))
    pool.add(makeBuff({ id: 'other', sourceId: 'b' }))

    expect(pool.getAll()).toHaveLength(2)
  })

  it('clear empties the pool', () => {
    pool.add(makeBuff())
    pool.clear()
    expect(pool.getAll()).toHaveLength(0)
  })
})
