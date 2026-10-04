import { describe, expect, it } from 'vitest'
import { clampUnit, layerFrame, parallaxOffset } from './parallaxMath'

describe('parallaxMath', () => {
  it('clampUnit bounds pointer input to [-1, 1]', () => {
    expect(clampUnit(0)).toBe(0)
    expect(clampUnit(2)).toBe(1)
    expect(clampUnit(-3.4)).toBe(-1)
    expect(clampUnit(0.42)).toBe(0.42)
  })

  it('cover-fits plus at least 2x rendered drift overscan per axis', () => {
    // auth layer at the canonical runtime ratio (~0.765 scale).
    const layer = { width: 1672, height: 941, maxDriftPx: { x: 18, y: 9 } }
    const frame = layerFrame(1280, 720, layer)

    expect(frame.width).toBeGreaterThanOrEqual(1280 + 2 * frame.maxOffsetX)
    expect(frame.height).toBeGreaterThanOrEqual(720 + 2 * frame.maxOffsetY)
    // drift scales with the rendered cover scale.
    const scale = frame.maxOffsetX / 18
    expect(frame.width).toBeCloseTo(1672 * scale, 5)
    expect(frame.height).toBeCloseTo(941 * scale, 5)
  })

  it('satisfies overscan on extreme containers (wide + tall)', () => {
    const layer = { width: 640, height: 470, maxDriftPx: { x: 8, y: 4 } }
    for (const [w, h] of [[320, 900], [1920, 200], [812, 610]] as const) {
      const frame = layerFrame(w, h, layer)
      expect(frame.width).toBeGreaterThanOrEqual(w + 2 * frame.maxOffsetX - 0.001)
      expect(frame.height).toBeGreaterThanOrEqual(h + 2 * frame.maxOffsetY - 0.001)
    }
  })

  it('offsets = -pointer * maxDrift, hard-clamped at both extremes', () => {
    const layer = { width: 1672, height: 941, maxDriftPx: { x: 18, y: 9 } }
    const frame = layerFrame(1280, 720, layer)

    const neutral = parallaxOffset(0, 0, frame, false)
    expect(neutral).toEqual({ x: 0, y: 0 })

    const maxNeg = parallaxOffset(-1, -1, frame, false)
    expect(maxNeg).toEqual({ x: frame.maxOffsetX, y: frame.maxOffsetY })

    const maxPos = parallaxOffset(1, 1, frame, false)
    expect(maxPos).toEqual({ x: -frame.maxOffsetX, y: -frame.maxOffsetY })

    // Out-of-range pointer input still clamps (defense in depth).
    const beyond = parallaxOffset(5, -5, frame, false)
    expect(beyond).toEqual({ x: -frame.maxOffsetX, y: frame.maxOffsetY })
  })

  it('returns exactly zero offsets under reduced motion', () => {
    const layer = { width: 1672, height: 941, maxDriftPx: { x: 18, y: 9 } }
    const frame = layerFrame(1280, 720, layer)
    expect(parallaxOffset(-1, 1, frame, true)).toEqual({ x: 0, y: 0 })
  })

  it('static layers never move', () => {
    const layer = { width: 1672, height: 941, maxDriftPx: { x: 0, y: 0 } }
    const frame = layerFrame(1280, 720, layer)
    expect(parallaxOffset(1, -1, frame, false)).toEqual({ x: 0, y: 0 })
  })
})
