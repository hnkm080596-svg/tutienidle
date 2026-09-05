import { describe, expect, it } from 'vitest'
import { PresentationGate } from './PresentationGate'

describe('PresentationGate', () => {
  it('never blocks if expect() was never called (headless/test default)', () => {
    const gate = new PresentationGate()

    expect(gate.isBlocking()).toBe(false)
  })

  it('blocks after expect(), until markReady() is called', () => {
    const gate = new PresentationGate()

    gate.expect()
    expect(gate.isBlocking(1_000, 15_000)).toBe(true)

    gate.markReady()
    expect(gate.isBlocking(1_000, 15_000)).toBe(false)
  })

  it('stays ready forever once markReady() fires, even if expect() is called again later', () => {
    const gate = new PresentationGate()

    gate.expect()
    gate.markReady()
    gate.expect()

    expect(gate.isBlocking(999_999, 15_000)).toBe(false)
  })

  it('safety-net: stops blocking once timeoutMs has elapsed without markReady() (Phaser boot failure fallback)', () => {
    const gate = new PresentationGate()

    gate.expect(0)
    expect(gate.isBlocking(0, 15_000)).toBe(true)
    expect(gate.isBlocking(20_000, 15_000)).toBe(false)

    // Once the safety-net trips, the gate is permanently open (matches
    // markReady() semantics) — a later call with an "early" nowMs must
    // still report not-blocking.
    expect(gate.isBlocking(20_001, 15_000)).toBe(false)
  })
})
