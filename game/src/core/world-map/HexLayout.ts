import type { HexCoordinate } from './HexCoordinate'

const SQRT_THREE = Math.sqrt(3)

export interface PixelPoint {
  x: number
  y: number
}

/**
 * A flat-top axial layout. `size` is the distance from the center to the
 * left/right corner, so a hex footprint is `2 * size` pixels wide and
 * `sqrt(3) * size` pixels high.
 */
export interface FlatTopHexLayout {
  size: number
  origin: PixelPoint
}

export interface PixelBounds {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export function axialToPixel(coordinate: HexCoordinate, layout: FlatTopHexLayout): PixelPoint {
  return {
    x: layout.origin.x + layout.size * 1.5 * coordinate.q,
    y: layout.origin.y + layout.size * SQRT_THREE * (coordinate.r + coordinate.q / 2),
  }
}

export function pixelToAxial(point: PixelPoint, layout: FlatTopHexLayout): HexCoordinate {
  if (layout.size <= 0) {
    throw new Error('Hex layout size must be greater than zero')
  }

  const x = (point.x - layout.origin.x) / layout.size
  const y = (point.y - layout.origin.y) / layout.size
  const fractionalQ = (2 / 3) * x
  const fractionalR = (-1 / 3) * x + (SQRT_THREE / 3) * y

  return roundAxial(fractionalQ, fractionalR)
}

export function getFlatTopHexCorners(
  coordinate: HexCoordinate,
  layout: FlatTopHexLayout,
): PixelPoint[] {
  const center = axialToPixel(coordinate, layout)

  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 180 * (60 * index)

    return {
      x: center.x + layout.size * Math.cos(angle),
      y: center.y + layout.size * Math.sin(angle),
    }
  })
}

export function getHexFootprintBounds(
  coordinates: readonly HexCoordinate[],
  layout: FlatTopHexLayout,
): PixelBounds | null {
  if (coordinates.length === 0) {
    return null
  }

  const halfWidth = layout.size
  const halfHeight = layout.size * SQRT_THREE / 2
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  for (const coordinate of coordinates) {
    const center = axialToPixel(coordinate, layout)

    left = Math.min(left, center.x - halfWidth)
    top = Math.min(top, center.y - halfHeight)
    right = Math.max(right, center.x + halfWidth)
    bottom = Math.max(bottom, center.y + halfHeight)
  }

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  }
}

function roundAxial(q: number, r: number): HexCoordinate {
  const s = -q - r
  let roundedQ = Math.round(q)
  let roundedR = Math.round(r)
  const roundedS = Math.round(s)
  const qDifference = Math.abs(roundedQ - q)
  const rDifference = Math.abs(roundedR - r)
  const sDifference = Math.abs(roundedS - s)

  if (qDifference > rDifference && qDifference > sDifference) {
    roundedQ = -roundedR - roundedS
  } else if (rDifference > sDifference) {
    roundedR = -roundedQ - roundedS
  }

  return { q: roundedQ, r: roundedR }
}
