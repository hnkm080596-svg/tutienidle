// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CombatClock, ManualClockSource, COMBAT_STEP_SECONDS, type ClockSource } from './CombatClock'

describe('CombatClock', () => {
  function makeClock() {
    const source = new ManualClockSource()
    const clock = new CombatClock(source)
    const steps: number[] = []
    clock.onStep((n) => steps.push(n))
    clock.start()
    return { source, clock, steps }
  }

  it('emits whole steps derived from elapsed time, not from frames', () => {
    const { source, steps } = makeClock()

    for (let i = 0; i < 10; i += 1) {
      source.advance(COMBAT_STEP_SECONDS / 10)
    }
    expect(steps.reduce((a, b) => a + b, 0)).toBe(1)

    source.advance(COMBAT_STEP_SECONDS * 3)
    expect(steps.reduce((a, b) => a + b, 0)).toBe(4)
  })

  it('discards off-screen time instead of banking it', () => {
    const { source, clock, steps } = makeClock()

    clock.freeze('tab-hidden')
    source.advance(COMBAT_STEP_SECONDS * 100)

    expect(steps).toEqual([])
    expect(clock.getState()).toBe('frozen')

    clock.resume('tab-hidden')
    source.advance(COMBAT_STEP_SECONDS)

    expect(steps.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('needs every reason resumed before it runs again', () => {
    const { source, clock, steps } = makeClock()

    clock.freeze('tab-hidden')
    clock.freeze('turn-in-flight')
    clock.resume('tab-hidden')

    source.advance(COMBAT_STEP_SECONDS * 5)
    expect(steps).toEqual([])
    expect(clock.getFreezeReasons()).toEqual(['turn-in-flight'])

    clock.resume('turn-in-flight')
    source.advance(COMBAT_STEP_SECONDS)
    expect(steps.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('is idempotent per reason', () => {
    const { clock } = makeClock()

    clock.freeze('turn-in-flight')
    clock.freeze('turn-in-flight')
    clock.resume('turn-in-flight')

    expect(clock.getState()).toBe('running')
    clock.resume('turn-in-flight')
    expect(clock.getState()).toBe('running')
  })

  it('recovers from non-finite input via untrusted ClockSource', () => {
    const maliciousSource: ClockSource = {
      start(onFrame) {
        // Send NaN
        onFrame(NaN)
        // Clock should recover and ignore NaN
        onFrame(COMBAT_STEP_SECONDS)
      },
      stop() {},
    }

    const clock = new CombatClock(maliciousSource)
    const steps: number[] = []
    clock.onStep((n) => steps.push(n))
    clock.start()

    expect(steps).toEqual([1])
    expect(clock.getState()).toBe('running')
  })

  it('knows nothing about turns, actors, or pipelines', () => {
    // The clock must never become the place where other people's rules are
    // kept. Every consumer decides for itself when a step applies.
    // The invariant: CombatClock never branches on a specific reason value.
    const source = readFileSync('src/core/battle/turn/CombatClock.ts', 'utf8')

    expect(source).not.toMatch(/if\s*\(\s*reason\s*===/)
    expect(source).not.toMatch(/switch\s*\(\s*reason\s*\)/)
    expect(source).not.toMatch(/reason\s*===\s*['"`]/)
    expect(source).not.toMatch(/['"`]\s*===\s*reason/)
  })

  it('ignores non-finite and non-positive frames', () => {
    const { source, steps } = makeClock()

    source.advance(NaN)
    source.advance(Infinity)
    source.advance(0)
    source.advance(-1)

    expect(steps).toEqual([])
  })

  it('stops counting once stopped', () => {
    const { source, clock, steps } = makeClock()

    clock.stop()
    source.advance(COMBAT_STEP_SECONDS * 10)

    expect(steps).toEqual([])
    expect(clock.getState()).toBe('stopped')
  })
})
