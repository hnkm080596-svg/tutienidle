import { describe, expect, it, vi } from 'vitest'

import { mulberry32 } from '../../SeededRandom'

import { FunctionCombatRng } from './FunctionCombatRng'
import { ScriptedCombatRng } from './ScriptedCombatRng'
import { SeededCombatRng } from './SeededCombatRng'

describe('SeededCombatRng', () => {
  it('same seed produces an identical 1000-roll sequence', () => {
    const a = new SeededCombatRng(1234)
    const b = new SeededCombatRng(1234)

    const seqA = Array.from({ length: 1000 }, () => a.roll())
    const seqB = Array.from({ length: 1000 }, () => b.roll())

    expect(seqA).toEqual(seqB)
  })

  it('different seeds produce different sequences', () => {
    const a = new SeededCombatRng(1)
    const b = new SeededCombatRng(2)

    const seqA = Array.from({ length: 100 }, () => a.roll())
    const seqB = Array.from({ length: 100 }, () => b.roll())

    expect(seqA).not.toEqual(seqB)
  })

  it('roll() output stays in [0, 1)', () => {
    const rng = new SeededCombatRng(7)

    for (let i = 0; i < 10_000; i++) {
      const v = rng.roll()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('matches the legacy mulberry32 stream (M4 cycle-rng reroute parity)', () => {
    const legacy = mulberry32(777)
    const rng = new SeededCombatRng(777)

    for (let i = 0; i < 1000; i++) {
      expect(rng.roll()).toBe(legacy())
    }
  })

  it('rollChance consumes exactly one roll even at chance <= 0 / >= 1', () => {
    // THE regression guard: legacy `rng() < chance` always consumed one
    // roll. An implementation that skips the roll at the 0/1 boundaries
    // shifts every subsequent consumer of the stream — the mixed calls
    // below must stay in lockstep with a pure roll() stream on the same
    // seed.
    const seed = 4242
    const mixed = new SeededCombatRng(seed)
    const pure = new SeededCombatRng(seed)

    pure.roll() // stream position 0 — consumed on the mixed side below
    expect(mixed.rollChance(0)).toBe(false) // forced false
    pure.roll() // position 1
    expect(mixed.rollChance(1)).toBe(true) // forced true
    const s2 = pure.roll() // position 2
    expect(mixed.rollChance(0.5)).toBe(s2 < 0.5)
    pure.roll() // position 3
    expect(mixed.rollChance(-3)).toBe(false) // forced false
    pure.roll() // position 4
    expect(mixed.rollChance(7)).toBe(true) // forced true

    // Positions 5..7 must be untouched by the boundary calls above.
    expect([mixed.roll(), mixed.roll(), mixed.roll()]).toEqual([
      pure.roll(),
      pure.roll(),
      pure.roll(),
    ])
  })

  it('rollChance is evaluated as roll() < chance', () => {
    const rng = new SeededCombatRng(9)
    const pure = new SeededCombatRng(9)

    const roll = pure.roll()
    expect(rng.rollChance(roll)).toBe(false) // roll exactly at chance fails
  })
})

describe('ScriptedCombatRng', () => {
  it('yields queued rolls in order', () => {
    const rng = new ScriptedCombatRng([0.1, 0.9, 0.5])

    expect(rng.roll()).toBe(0.1)
    expect(rng.roll()).toBe(0.9)
    expect(rng.roll()).toBe(0.5)
  })

  it('throws on exhaustion', () => {
    const rng = new ScriptedCombatRng([0.3])
    rng.roll()

    expect(() => rng.roll()).toThrow()
    expect(() => new ScriptedCombatRng([]).roll()).toThrow()
  })

  it('rollChance consumes exactly one scripted roll', () => {
    const rng = new ScriptedCombatRng([0.4, 0.6])

    expect(rng.rollChance(0.5)).toBe(true)
    expect(rng.rollChance(0.5)).toBe(false)
    expect(() => rng.rollChance(0.5)).toThrow()
  })

  it('boundary: a roll exactly at chance fails', () => {
    const rng = new ScriptedCombatRng([0.5, 0.5])

    expect(rng.rollChance(0.5)).toBe(false)
    expect(rng.rollChance(0.500001)).toBe(true)
  })
})

describe('FunctionCombatRng', () => {
  it('invokes the wrapped function once per roll (lazy)', () => {
    let calls = 0
    const rng = new FunctionCombatRng(() => {
      calls += 1
      return 0.5
    })

    rng.roll()
    rng.rollChance(1)
    rng.rollChance(0)

    expect(calls).toBe(3)
  })

  it('vi.spyOn(Math, "random") still intercepts after construction', () => {
    const rng = new FunctionCombatRng(() => Math.random())
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.25)

    try {
      expect(rng.roll()).toBe(0.25)
      expect(rng.rollChance(0.5)).toBe(true)
      expect(spy).toHaveBeenCalledTimes(2)
    } finally {
      spy.mockRestore()
    }
  })
})
