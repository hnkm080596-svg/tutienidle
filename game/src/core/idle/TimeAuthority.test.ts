import { describe, expect, it } from 'vitest'
import { TimeAuthority } from './TimeAuthority'
import { utcDayBucket } from './GameClock'

const T0 = Date.UTC(2026, 9, 12, 12, 0, 0)

function harness(wallStart = T0, monoStart = 0) {
  let wall = wallStart
  let mono = monoStart

  const authority = new TimeAuthority({
    wallNow: () => wall,
    monotonicNow: () => mono,
  })

  return {
    authority,
    setWall: (value: number) => {
      wall = value
    },
    advanceMono: (ms: number) => {
      mono += ms
    },
    getWall: () => wall,
    getMono: () => mono,
  }
}

describe('TimeAuthority (GP-01)', () => {
  it('replaces a forged preboot epoch with the first server anchor, then never rewinds', () => {
    const { authority, advanceMono } = harness(T0 + 86_400_000)
    expect(authority.anchorFromServer(T0)).toBe(true)
    expect(authority.now()).toBe(T0)
    advanceMono(1_000)
    expect(authority.anchorFromServer(T0 - 86_400_000)).toBe(true)
    expect(authority.now()).toBe(T0 + 1_000)
  })
  it('rejects invalid first server stamps without consuming the initialization', () => {
    const { authority } = harness(T0 + 86_400_000)
    expect(authority.anchorFromServer(Number.NaN)).toBe(false)
    expect(authority.anchorFromServer(T0)).toBe(true)
    expect(authority.now()).toBe(T0)
  })
  it('recovers from an unavailable monotonic source at construction without granting unknown elapsed', () => {
    let mono = Number.NaN
    const time = new TimeAuthority({ wallNow: () => T0, monotonicNow: () => mono })
    expect(time.now()).toBe(T0)
    mono = 5_000
    expect(time.now()).toBe(T0)
    mono = 6_000
    expect(time.now()).toBe(T0 + 1_000)
  })
  it('reads the wall clock exactly once - later system-clock edits cannot move now()', () => {
    let wallReads = 0
    const authority = new TimeAuthority({
      wallNow: () => {
        wallReads += 1
        return T0
      },
      monotonicNow: () => 0,
    })

    expect(authority.now()).toBe(T0)
    expect(wallReads).toBe(1)
  })

  it('now() advances only by monotonic elapsed after the anchor', () => {
    const { authority, advanceMono } = harness()

    advanceMono(5_000)
    expect(authority.now()).toBe(T0 + 5_000)

    advanceMono(1_000)
    expect(authority.now()).toBe(T0 + 6_000)
  })

  it('a +24h system-clock jump leaves now() at the monotonic position', () => {
    const { authority, setWall, advanceMono } = harness()

    advanceMono(1_000)
    setWall(T0 + 86_400_000) // attacker fast-forwards a full day

    expect(authority.now()).toBe(T0 + 1_000)
    expect(authority.dayBucket()).toBe(utcDayBucket(T0))
  })

  it('a -24h system-clock rewind leaves now() at the monotonic position', () => {
    const { authority, setWall, advanceMono } = harness()

    advanceMono(1_000)
    setWall(T0 - 86_400_000)

    expect(authority.now()).toBe(T0 + 1_000)
  })

  it('now() is non-decreasing even if the monotonic source steps back', () => {
    let mono = 10_000
    const authority = new TimeAuthority({
      wallNow: () => T0,
      monotonicNow: () => mono,
    })

    expect(authority.now()).toBe(T0)

    mono += 5_000
    expect(authority.now()).toBe(T0 + 5_000)

    mono = 0 // monotonic reset (never rewinds the authorized clock)
    expect(authority.now()).toBe(T0 + 5_000)
  })

  it('a non-finite monotonic read holds the last value instead of poisoning now()', () => {
    let mono: number = 0
    const authority = new TimeAuthority({
      wallNow: () => T0,
      monotonicNow: () => mono,
    })

    expect(authority.now()).toBe(T0)

    mono = Number.NaN
    expect(authority.now()).toBe(T0)

    mono = 2_000
    expect(authority.now()).toBe(T0 + 2_000)
  })

  it('nowSeconds() reports now()/1000', () => {
    const { authority, advanceMono } = harness()

    advanceMono(1_500)
    expect(authority.nowSeconds()).toBe((T0 + 1_500) / 1000)
  })

  it('dayBucket() matches utcDayBucket(now())', () => {
    const { authority, advanceMono } = harness()

    expect(authority.dayBucket()).toBe(utcDayBucket(authority.now()))

    advanceMono(86_400_000)
    expect(authority.dayBucket()).toBe(utcDayBucket(T0) + 1)
  })

  it('rebase moves the anchor forward to the server bound', () => {
    const { authority, advanceMono } = harness()

    advanceMono(1_000)
    authority.rebase(T0 + 60_000)

    expect(authority.now()).toBe(T0 + 60_000)

    advanceMono(5_000)
    expect(authority.now()).toBe(T0 + 65_000)
  })

  it('rebase never rewinds the clock (backward server stamps are clamped)', () => {
    const { authority, advanceMono } = harness()

    advanceMono(60_000)
    authority.rebase(T0 + 1_000) // server stamp behind the live position

    expect(authority.now()).toBe(T0 + 60_000)

    advanceMono(5_000)
    expect(authority.now()).toBe(T0 + 65_000)
  })

  it('rebase ignores non-finite stamps', () => {
    const { authority, advanceMono } = harness()

    advanceMono(1_000)
    authority.rebase(Number.NaN)
    authority.rebase(Number.POSITIVE_INFINITY)

    expect(authority.now()).toBe(T0 + 1_000)
  })

  it('retains an authenticated forward rebase while monotonic samples are unavailable', () => {
    let mono = 0
    const authority = new TimeAuthority({ wallNow: () => T0, monotonicNow: () => mono })
    expect(authority.anchorFromServer(T0)).toBe(true)
    mono = Number.NaN
    authority.rebase(T0 + 60_000)
    expect(authority.now()).toBe(T0 + 60_000)
    mono = 1_000
    expect(authority.now()).toBe(T0 + 60_000)
    mono = 2_000
    expect(authority.now()).toBe(T0 + 61_000)
  })

  it('monotonic() exposes the raw elapsed source, unaffected by wall edits', () => {
    const { authority, setWall, advanceMono } = harness()

    advanceMono(2_500)
    setWall(T0 + 86_400_000)

    expect(authority.monotonic()).toBe(2_500)
  })

  it('a non-finite boot wall anchors at 0 (deny direction) instead of NaN', () => {
    let mono = 1_000
    const authority = new TimeAuthority({
      wallNow: () => Number.NaN,
      monotonicNow: () => mono,
    })

    expect(authority.now()).toBe(0)

    mono = 2_500
    expect(authority.now()).toBe(1_500)
  })
})
