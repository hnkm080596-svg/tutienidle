import { describe, expect, it } from 'vitest'
import { makeFlightCurve, sampleCurve, flightProgress } from './trajectory'

describe('skill trajectory', () => {
  it('joins exact endpoints with a curved midpoint and tangent facing along travel', () => {
    const curve = makeFlightCurve({ x: 0, y: 0 }, { x: 100, y: 0 }, 40)
    expect(sampleCurve(curve, 0)).toMatchObject({ x: 0, y: 0 })
    expect(sampleCurve(curve, 1)).toMatchObject({ x: 100, y: 0 })
    const middle = sampleCurve(curve, 0.5)
    expect(middle.x).toBeCloseTo(50)
    expect(middle.y).toBeCloseTo(30)
    expect(middle.angle).toBeCloseTo(0)
  })
  it('rotates a reversed trajectory instead of assuming the player faces right', () => {
    const sample = sampleCurve(makeFlightCurve({ x: 100, y: 0 }, { x: 0, y: 0 }, 0), 0.5)
    expect(Math.abs(sample.angle)).toBeCloseTo(Math.PI)
  })
  it('keeps collapsed paths and out-of-range samples finite', () => {
    const curve = makeFlightCurve({ x: 4, y: 8 }, { x: 4, y: 8 }, 0)
    for (const progress of [-1, 0, 0.5, 1, 2]) {
      expect(sampleCurve(curve, progress)).toEqual({ x: 4, y: 8, angle: 0 })
    }
  })
  it('holds release, cruises, then gains speed before reaching the commit point', () => {
    expect(flightProgress(119, 120, 180, 70)).toBe(0)
    expect(flightProgress(120, 120, 180, 70)).toBe(0)
    expect(flightProgress(300, 120, 180, 70)).toBeCloseTo(0.7)
    expect(flightProgress(370, 120, 180, 70)).toBe(1)
    expect(flightProgress(500, 120, 180, 70)).toBe(1)
    const earlier = flightProgress(340, 120, 180, 70) - flightProgress(330, 120, 180, 70)
    const later = flightProgress(370, 120, 180, 70) - flightProgress(360, 120, 180, 70)
    expect(later).toBeGreaterThan(earlier)
  })
})
