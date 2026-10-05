import { describe, expect, it } from 'vitest'
import { weightedRandom } from './DropRoll'

// T8-71 - the roll used to crash with an opaque TypeError
// (entries[entries.length - 1]!.value on an empty table). Fail loudly
// with a descriptive error instead.
describe('weightedRandom', () => {
  it('throws a descriptive error on empty entries', () => {
    expect(() => weightedRandom([])).toThrow('weightedRandom: empty entries')
  })

  it('picks the only entry of a single-entry table', () => {
    expect(weightedRandom([{ value: 'a', weight: 5 }])).toBe('a')
  })

  it('throws on a zero/negative-weight pool instead of paying the last entry (r13-COR-6)', () => {
    expect(() =>
      weightedRandom([
        { value: 'a', weight: 0 },
        { value: 'b', weight: 0 },
      ]),
    ).toThrow('weightedRandom: entry weights must be finite and positive')

    expect(() => weightedRandom([{ value: 'a', weight: -1 }])).toThrow(
      'weightedRandom: entry weights must be finite and positive',
    )
  })
})
