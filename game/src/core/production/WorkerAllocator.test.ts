import { describe, expect, it } from 'vitest'
import { allocateWorkerSlots } from './WorkerAllocator'

// R7 (AR-07): single workforce distribution rule shared by online
// tickWorkers and offline settleWorkersOffline. Matrix from the spec
// (spec 6): manual-first order, remainder round-robin over UNASSIGNED
// sites only, idle remainder when no unassigned site exists.
describe('allocateWorkerSlots', () => {
  it('assigns manual sites first in given order, clamped to remaining capacity', () => {
    const result = allocateWorkerSlots(['a', 'b'], new Map([['a', 2], ['b', 5]]), 6)
    expect(result.get('a')).toBe(2)
    expect(result.get('b')).toBe(4) // clamped by remaining
  })

  it('round-robins remainder across unassigned sites in order', () => {
    const result = allocateWorkerSlots(['a', 'b', 'c'], new Map([['a', 1]]), 6)
    expect(result.get('a')).toBe(1)
    expect(result.get('b')).toBe(3) // 5 remaining / 2 unassigned sites
    expect(result.get('c')).toBe(2)
  })

  it('leaves remainder IDLE when every site is manual (AR-07 crash case)', () => {
    const result = allocateWorkerSlots(['a'], new Map([['a', 1]]), 3)
    expect(result.get('a')).toBe(1) // remainder 2 stays idle, no throw
  })

  it('returns empty map when no active sites', () => {
    expect(allocateWorkerSlots([], new Map(), 5).size).toBe(0)
  })

  it('returns all zeros when capacity is 0', () => {
    const result = allocateWorkerSlots(['a', 'b'], new Map(), 0)
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(0)
  })

  it('floors non-integer capacity and clamps negative assignments', () => {
    const result = allocateWorkerSlots(['a', 'b'], new Map([['a', -2], ['b', 1.9]]), 4.7)
    expect(result.get('a')).toBe(0)
    // b takes min(floor(1.9), 4) = 1 in the manual pass. Both sites have
    // assignment entries, so the auto set is empty and the remainder 3
    // stays IDLE (same invariant as the all-manual case above).
    expect(result.get('b')).toBe(1)
  })

  it('is deterministic for identical inputs', () => {
    const inputs = () => allocateWorkerSlots(['x', 'y', 'z'], new Map([['y', 2]]), 7)
    expect([...inputs()]).toEqual([...inputs()])
  })
})
