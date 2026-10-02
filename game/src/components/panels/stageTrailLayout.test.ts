import { describe, expect, it } from 'vitest'

import { layoutStageTrail } from './stageTrailLayout'

describe('layoutStageTrail', () => {
  it('returns empty geometry for an empty stage list', () => {
    expect(layoutStageTrail(0)).toEqual({ points: [], pathD: '' })
  })

  it('walks a serpentine: rows alternate direction, final row centers', () => {
    const { points } = layoutStageTrail(10)
    expect(points).toHaveLength(10)
    // Row 0 runs left -> right.
    expect(points[0]!.x).toBeLessThan(points[1]!.x)
    // Row 1 runs right -> left (first node of row 1 sits at the right edge).
    expect(points[4]!.x).toBeGreaterThan(points[5]!.x)
    // Rows stack vertically.
    expect(points[0]!.y).toBeLessThan(points[4]!.y)
    // Short final row (2 nodes) centers around x=0.5.
    expect(points[8]!.x).toBeLessThan(0.5)
    expect(points[9]!.x).toBeGreaterThan(0.5)
  })

  it('emits a path in the 0..1000 viewBox space the SVG declares', () => {
    const { pathD } = layoutStageTrail(10)
    const coords = pathD.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    expect(coords.length).toBeGreaterThan(0)
    // Node fractions 0.14..0.86 must land at ~140..860 viewBox units -
    // a 0..100 scale here collapses the trail into the map corner.
    expect(Math.max(...coords)).toBeGreaterThan(500)
    expect(Math.min(...coords)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...coords)).toBeLessThanOrEqual(1000)
  })

  it('single-stage maps still emit a point and a degenerate path', () => {
    const { points, pathD } = layoutStageTrail(1)
    expect(points).toHaveLength(1)
    expect(pathD.startsWith('M ')).toBe(true)
  })
})
