import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCombatClockHost } from './combatClockHost'

describe('combatClockHost', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits elapsed seconds on each tick', () => {
    vi.useFakeTimers()
    const ticks: number[] = []
    const host = createCombatClockHost()

    host.start(50, (d) => ticks.push(d))
    vi.advanceTimersByTime(200)
    host.stop()

    expect(ticks.length).toBeGreaterThanOrEqual(3)
    expect(ticks.every((d) => d > 0.04 && d < 0.06)).toBe(true)
  })

  it('stops cleanly', () => {
    vi.useFakeTimers()
    const ticks: number[] = []
    const host = createCombatClockHost()

    host.start(50, (d) => ticks.push(d))
    host.stop()
    vi.advanceTimersByTime(500)

    expect(ticks).toEqual([])
  })

  it('drops a stalled interval instead of replaying it', () => {
    // OS sleep, lid close, suspended process: the interval fires once with an
    // enormous elapsed. Combat has no catch-up, so that gap is discarded.
    vi.useFakeTimers()
    const ticks: number[] = []
    const host = createCombatClockHost()

    host.start(50, (d) => ticks.push(d))
    vi.advanceTimersByTime(50)

    const beforeStall = ticks.length

    // Jump the wall clock far past the stall threshold without running timers,
    // then let one interval fire.
    vi.setSystemTime(new Date(Date.now() + 8 * 60 * 60 * 1000))
    vi.advanceTimersByTime(50)

    host.stop()

    expect(ticks.length).toBe(beforeStall)
  })

  it('resets the stall baseline on resume so the next interval reports normally', () => {
    // Ruling 3: powerMonitor's 'resume' event is a precise signal that the OS
    // was asleep. reset() re-anchors `last` to now so the tick right after
    // resume is not itself measured against the pre-sleep timestamp (which
    // would otherwise trip the stall guard forever).
    vi.useFakeTimers()
    const ticks: number[] = []
    const host = createCombatClockHost()

    host.start(50, (d) => ticks.push(d))
    vi.advanceTimersByTime(50)

    vi.setSystemTime(new Date(Date.now() + 8 * 60 * 60 * 1000))
    host.reset()
    vi.advanceTimersByTime(50)
    host.stop()

    expect(ticks.length).toBeGreaterThanOrEqual(2)
    expect(ticks.every((d) => d > 0.04 && d < 0.06)).toBe(true)
  })
})
