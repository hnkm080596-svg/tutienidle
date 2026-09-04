import { describe, expect, it } from 'vitest'
import { TurnBuffPool } from './TurnBuffPool'
import type { TurnBuff } from './TurnBuffTypes'

function makeBuff(overrides: Partial<TurnBuff> = {}): TurnBuff {
  return {
    id: 'test_buff',
    sourceId: 'source_1',
    targetId: 'target_1',
    polarity: 'debuff',
    duration: 5,
    remainingTurns: 5,
    stacks: 1,
    stackMode: 'refresh',
    continuousTurns: 0,
    effects: [],
    ...overrides,
  }
}

describe('TurnBuffPool', () => {
  it('add + getFromSource finds the exact (id, sourceId) instance', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff())

    expect(pool.getFromSource('test_buff', 'source_1')).toBeDefined()
    expect(pool.getFromSource('test_buff', 'other_source')).toBeUndefined()
  })

  it('getAllById returns every instance of an id regardless of source', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff({ sourceId: 'source_1' }))
    pool.add(makeBuff({ sourceId: 'source_2' }))

    expect(pool.getAllById('test_buff')).toHaveLength(2)
  })

  it('hasAny reflects presence by id only', () => {
    const pool = new TurnBuffPool()
    expect(pool.hasAny('test_buff')).toBe(false)

    pool.add(makeBuff())
    expect(pool.hasAny('test_buff')).toBe(true)
  })

  it('removeInstance removes only the matching (id, sourceId) pair', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff({ sourceId: 'source_1' }))
    pool.add(makeBuff({ sourceId: 'source_2' }))

    pool.removeInstance('test_buff', 'source_1')

    expect(pool.getFromSource('test_buff', 'source_1')).toBeUndefined()
    expect(pool.getFromSource('test_buff', 'source_2')).toBeDefined()
  })

  it('removeAllById removes every instance of an id across all sources', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff({ sourceId: 'source_1' }))
    pool.add(makeBuff({ sourceId: 'source_2' }))

    pool.removeAllById('test_buff')

    expect(pool.getAll()).toHaveLength(0)
  })

  it('clear empties the pool', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff())
    pool.clear()

    expect(pool.getAll()).toHaveLength(0)
  })

  it('getAll returns a snapshot copy, not the live internal array', () => {
    const pool = new TurnBuffPool()
    pool.add(makeBuff())

    const snapshot = pool.getAll()
    snapshot.push(makeBuff({ id: 'injected' }))

    expect(pool.getAll()).toHaveLength(1)
  })
})
