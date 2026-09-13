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

  it('stop() inside its own frame callback leaves no pending frame (ARCH-013/L04)', () => {
    // Combat-over calls clock.stop() from inside the step the clock itself
    // delivered. Before the generation fence the frame tail still re-armed
    // after that stop, and each fired frame re-armed again — a ghost loop
    // of no-op frames for the rest of the session.
    const frames: Array<(t: number) => void> = []
    vi.stubGlobal('requestAnimationFrame', ((cb: (t: number) => void) => {
      frames.push(cb)
      return frames.length
    }) as typeof requestAnimationFrame)
    const cancelMock = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancelMock as typeof cancelAnimationFrame)

    const source = new RafClockSource()
    let fired = 0
    const pump = (t: number) => {
      frames[fired++]!(t)
    }

    source.start(() => source.stop())

    pump(1000) // first frame only primes the timestamp and re-arms
    expect(frames.length - fired).toBe(1)

    pump(1016) // onFrame runs -> stop() must prevent the re-arm

    expect(frames.length - fired).toBe(0)
    expect(cancelMock).toHaveBeenCalled()
  })

  it('stop()+start() inside the callback keeps exactly one live loop', () => {
    // A battle restart can legitimately happen inside a frame (stop/start
    // is the engine's per-battle reset). The old frame must NOT also
    // re-arm: two scheduled frame closures sharing the loop would double
    // every subsequent tick.
    const frames: Array<(t: number) => void> = []
    vi.stubGlobal('requestAnimationFrame', ((cb: (t: number) => void) => {
      frames.push(cb)
      return frames.length
    }) as typeof requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn() as typeof cancelAnimationFrame)

    const source = new RafClockSource()
    const deltas: number[] = []
    let fired = 0
    const pump = (t: number) => {
      frames[fired++]!(t)
    }

    source.start((d) => {
      deltas.push(d)
      source.stop()
      source.start((d2) => deltas.push(d2))
    })

    pump(1000)
    pump(1016) // cbA runs -> stop+start -> the NEW generation armed its frame

    // Exactly one pending rAF — the stale frame did not re-arm alongside it.
    expect(frames.length - fired).toBe(1)
    expect(deltas).toHaveLength(1)

    pump(1032) // new generation's first frame: lastTimestamp was reset -> no delta
    expect(deltas).toHaveLength(1)

    pump(1048)
    pump(1064)
    expect(deltas).toHaveLength(3)
    expect(frames.length - fired).toBe(1)
  })
})
