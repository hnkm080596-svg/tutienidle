import { describe, expect, it } from 'vitest'
import { PillBag } from './PillBag'
import type { Pill } from './Pill'

const PILL: Pill = {
  id: 'test_pill',
  name: 'Test Pill',
  type: 'cultivation',
  grade: 'hoang',
  effects: [],
}

describe('PillBag', () => {
  it('stack accessors trả snapshot — caller mutate không rò vào bag', () => {
    const bag = new PillBag()

    bag.add(PILL, 3)

    const viaGet = bag.get('test_pill') as { amount: number }
    viaGet.amount = 0

    expect(bag.getAmount('test_pill')).toBe(3)

    const viaAll = bag.getAll()[0] as { amount: number }
    viaAll.amount = 0

    expect(bag.getAmount('test_pill')).toBe(3)
  })
})
