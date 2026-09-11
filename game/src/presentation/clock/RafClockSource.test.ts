// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RafClockSource } from './RafClockSource'

describe('RafClockSource', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reports elapsed seconds between frames and stops cleanly', () => {
    const frames: Array<(t: number) => void> = []
    let nextHandle = 1

    vi.stubGlobal('requestAnimationFrame', ((cb: (t: number) => void) => {
      frames.push(cb)
      return nextHandle++
    }) as typeof requestAnimationFrame)
    const cancelMock = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancelMock as typeof cancelAnimationFrame)

    const source = new RafClockSource()
    const deltas: number[] = []
    source.start((d) => deltas.push(d))

    frames[0]!(1000)
    frames[1]!(1016)
    frames[2]!(1032)

    expect(deltas.length).toBe(2)
    expect(deltas[0]).toBeCloseTo(0.016, 3)

    source.stop()
    expect(cancelMock).toHaveBeenCalled()
  })

  it('drops an unreasonably large gap rather than reporting it', () => {
    const frames: Array<(t: number) => void> = []
    vi.stubGlobal('requestAnimationFrame', ((cb: (t: number) => void) => {
      frames.push(cb)
      return frames.length
    }) as typeof requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn() as typeof cancelAnimationFrame)

    const source = new RafClockSource()
    const deltas: number[] = []
    source.start((d) => deltas.push(d))

    frames[0]!(1000)
    // Simulate a stall: next frame arrives 3 seconds later with no freeze
    // reason set. The clock must not bank the gap.
    frames[1]!(4000)

    expect(deltas.every((d) => d < 1)).toBe(true)
  })

  it('keeps the loop alive when a frame callback throws', () => {
    // onFrame is the whole turn-resolution stack. A throw anywhere in it (a
    // stage with no enemy template, say) must not be terminal: if the rAF is
    // never re-armed, combat stops forever and start() refuses to restart it
    // because handle is still non-null. Characters keep animating, so it looks
    // alive while nothing advances.
    const frames: Array<(t: number) => void> = []
    vi.stubGlobal('requestAnimationFrame', ((cb: (t: number) => void) => {
      frames.push(cb)
      return frames.length
    }) as typeof requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn() as typeof cancelAnimationFrame)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const source = new RafClockSource()
    const seen: number[] = []
    let throwNext = false

    source.start((d) => {
      if (throwNext) {
        throwNext = false
        throw new Error('spawnEnemy: no template available for stage')
      }
      seen.push(d)
    })

    frames[0]!(1000)
    throwNext = true
    frames[1]!(1016)

    // The throwing frame must still have re-armed the loop.
    expect(frames.length).toBe(3)

    frames[2]!(1032)
    expect(seen.length).toBe(1)
    expect(seen[0]).toBeCloseTo(0.016, 3)
    expect(consoleError).toHaveBeenCalled()
  })
})
