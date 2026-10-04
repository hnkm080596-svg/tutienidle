import { describe, expect, it } from 'vitest'
import { layoutRadialGraph } from './skillGraphLayout'

const distanceFrom = (x: number, y: number, cx: number, cy: number) =>
  Math.hypot(x - cx, y - cy)

describe('layoutRadialGraph', () => {
  it('returns an empty canvas for an empty graph', () => {
    const layout = layoutRadialGraph([])
    expect(layout.size).toBe(0)
    expect(layout.positions.size).toBe(0)
  })

  it('places a single root at the canvas center', () => {
    const layout = layoutRadialGraph([{ id: 'root', parentId: null, depth: 0 }])
    const center = layout.size / 2
    const pos = layout.positions.get('root')!

    expect(pos.x).toBeCloseTo(center)
    expect(pos.y).toBeCloseTo(center)
  })

  it('puts deeper nodes on strictly wider orbits', () => {
    const layout = layoutRadialGraph([
      { id: 'root', parentId: null, depth: 0 },
      { id: 'mid', parentId: 'root', depth: 1 },
      { id: 'leaf', parentId: 'mid', depth: 2 },
    ])
    const center = layout.size / 2

    const dRoot = distanceFrom(
      layout.positions.get('root')!.x,
      layout.positions.get('root')!.y,
      center,
      center,
    )
    const dMid = distanceFrom(
      layout.positions.get('mid')!.x,
      layout.positions.get('mid')!.y,
      center,
      center,
    )
    const dLeaf = distanceFrom(
      layout.positions.get('leaf')!.x,
      layout.positions.get('leaf')!.y,
      center,
      center,
    )

    expect(dRoot).toBeLessThan(dMid)
    expect(dMid).toBeLessThan(dLeaf)
  })

  it('keeps children inside their parent sector (no cross-branch overlap)', () => {
    const layout = layoutRadialGraph([
      { id: 'a', parentId: null, depth: 0 },
      { id: 'a1', parentId: 'a', depth: 1 },
      { id: 'a2', parentId: 'a', depth: 1 },
      { id: 'b', parentId: null, depth: 0 },
      { id: 'b1', parentId: 'b', depth: 1 },
    ])

    const angleOf = (id: string) => {
      const center = layout.size / 2
      const pos = layout.positions.get(id)!
      return Math.atan2(pos.y - center, pos.x - center)
    }

    // Sibling subtrees occupy disjoint sectors: a's children cluster near
    // a's angle, b's child near b's.
    const aAngle = angleOf('a')
    const bAngle = angleOf('b')

    for (const id of ['a1', 'a2']) {
      const diff = Math.abs(angleOf(id) - aAngle)
      expect(Math.min(diff, 2 * Math.PI - diff)).toBeLessThan(Math.PI / 2)
    }
    const bDiff = Math.abs(angleOf('b1') - bAngle)
    expect(Math.min(bDiff, 2 * Math.PI - bDiff)).toBeLessThan(Math.PI / 2)
  })

  it('produces identical output for identical input (deterministic)', () => {
    const nodes = [
      { id: 'r', parentId: null, depth: 0 },
      { id: 'c1', parentId: 'r', depth: 1 },
      { id: 'c2', parentId: 'r', depth: 1 },
      { id: 'g1', parentId: 'c1', depth: 2 },
    ]
    const a = layoutRadialGraph(nodes)
    const b = layoutRadialGraph(nodes)

    expect(a.size).toBe(b.size)
    for (const node of nodes) {
      expect(a.positions.get(node.id)).toEqual(b.positions.get(node.id))
    }
  })
})
