import { describe, expect, it } from 'vitest'
import { getHexDistance, getHexNeighbor, getHexNeighbors } from './HexCoordinate'
import {
  axialToPixel,
  getFlatTopHexCorners,
  getHexFootprintBounds,
  pixelToAxial,
  type FlatTopHexLayout,
} from './HexLayout'

const layout: FlatTopHexLayout = {
  size: 100,
  origin: { x: 300, y: 200 },
}

describe('flat-top hex layout', () => {
  it('maps axial coordinates to expected pixel centers', () => {
    expect(axialToPixel({ q: 0, r: 0 }, layout)).toEqual({ x: 300, y: 200 })
    expect(axialToPixel({ q: 2, r: -1 }, layout)).toEqual({ x: 600, y: 200 })
  })

  it('round-trips tile centers and rounds nearby pixels to the same tile', () => {
    const coordinate = { q: -2, r: 3 }
    const center = axialToPixel(coordinate, layout)

    expect(pixelToAxial(center, layout)).toEqual(coordinate)
    expect(pixelToAxial({ x: center.x + 10, y: center.y - 8 }, layout)).toEqual(coordinate)
  })

  it('returns six corners and complete footprint bounds', () => {
    expect(getFlatTopHexCorners({ q: 0, r: 0 }, layout)).toHaveLength(6)

    const bounds = getHexFootprintBounds([{ q: 0, r: 0 }, { q: 1, r: 0 }], layout)

    expect(bounds).not.toBeNull()
    expect(bounds?.left).toBeCloseTo(200)
    expect(bounds?.right).toBeCloseTo(550)
    expect(bounds?.height).toBeCloseTo(100 * Math.sqrt(3) * 1.5)
  })
})

describe('hex coordinate helpers', () => {
  it('returns six unique neighbors and normalizes direction indexes', () => {
    const neighbors = getHexNeighbors({ q: 4, r: -2 })

    expect(new Set(neighbors.map(neighbor => `${neighbor.q},${neighbor.r}`))).toHaveLength(6)
    expect(getHexNeighbor({ q: 0, r: 0 }, 6)).toEqual({ q: 1, r: 0 })
    expect(getHexNeighbor({ q: 0, r: 0 }, -1)).toEqual({ q: 0, r: 1 })
  })

  it('calculates axial distance', () => {
    expect(getHexDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3)
    expect(getHexDistance({ q: -4, r: 2 }, { q: -4, r: 2 })).toBe(0)
  })
})
