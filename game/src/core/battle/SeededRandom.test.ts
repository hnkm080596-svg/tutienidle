import { describe, expect, it } from 'vitest'
import { mulberry32 } from './SeededRandom'

describe('mulberry32', () => {
  it('same seed produces an identical sequence', () => {
    const a = mulberry32(1234)
    const b = mulberry32(1234)

    const seqA = Array.from({ length: 100 }, () => a())
    const seqB = Array.from({ length: 100 }, () => b())

    expect(seqA).toEqual(seqB)
  })

  it('different seeds produce different sequences', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)

    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())

    expect(seqA).not.toEqual(seqB)
  })

  it('output stays in [0, 1)', () => {
    const rng = mulberry32(0)

    for (let i = 0; i < 10_000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
