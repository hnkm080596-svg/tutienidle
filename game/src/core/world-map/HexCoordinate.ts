export interface HexCoordinate {
  q: number
  r: number
}

export const HEX_DIRECTIONS: readonly HexCoordinate[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function hexCoordinateKey(coordinate: HexCoordinate): string {
  return `${coordinate.q},${coordinate.r}`
}

export function addHexCoordinates(left: HexCoordinate, right: HexCoordinate): HexCoordinate {
  return {
    q: left.q + right.q,
    r: left.r + right.r,
  }
}

export function getHexNeighbor(coordinate: HexCoordinate, direction: number): HexCoordinate {
  const normalizedDirection = ((direction % HEX_DIRECTIONS.length) + HEX_DIRECTIONS.length)
    % HEX_DIRECTIONS.length
  const offset = HEX_DIRECTIONS[normalizedDirection]

  if (!offset) {
    throw new Error(`Invalid hex direction: ${direction}`)
  }

  return addHexCoordinates(coordinate, offset)
}

export function getHexNeighbors(coordinate: HexCoordinate): HexCoordinate[] {
  return HEX_DIRECTIONS.map(direction => addHexCoordinates(coordinate, direction))
}

export function getHexDistance(left: HexCoordinate, right: HexCoordinate): number {
  const dq = left.q - right.q
  const dr = left.r - right.r
  const ds = -dq - dr

  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds))
}
