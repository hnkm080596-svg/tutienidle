import type { HexCoordinate } from './HexCoordinate'

export interface PixelRectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface SpriteAnchor {
  /** Horizontal anchor in normalized image coordinates. */
  x: number
  /** Vertical anchor in normalized image coordinates. */
  y: number
}

export type WorldMapSpriteSource =
  | {
      kind: 'image'
      url: string
    }
  | {
      kind: 'sheet'
      url: string
      frame: PixelRectangle
    }

/**
 * Normalized sprite metadata consumed by the renderer. An atlas importer can
 * resolve named frames into the `sheet` variant without coupling map data to a
 * particular atlas exporter.
 */
export interface WorldMapSpriteDefinition {
  id: string
  source: WorldMapSpriteSource
  /** Normalized position inside the sprite that sits on the hex center. */
  anchor?: SpriteAnchor
}

export interface WorldMapTile {
  id: string
  coordinate: HexCoordinate
  /** Base terrain sprite. */
  spriteId: string
  /** Optional overlays, rendered in array order after the base sprite. */
  overlaySpriteIds?: string[]
  /** Optional gameplay stage represented by this tile. */
  stageId?: string
  /** Higher elevation is rendered after tiles at the same screen row. */
  elevation?: number
  /** Free-form semantic tag for tools and future terrain rules. */
  terrainId?: string
}

export interface WorldMapDefinition {
  id: string
  zoneId: string
  name: string
  initialCenter: HexCoordinate
  sprites: WorldMapSpriteDefinition[]
  tiles: WorldMapTile[]
}

export function compareWorldMapTileDepth(left: WorldMapTile, right: WorldMapTile): number {
  const leftRow = left.coordinate.r + left.coordinate.q / 2
  const rightRow = right.coordinate.r + right.coordinate.q / 2
  const rowDifference = leftRow - rightRow

  if (rowDifference !== 0) {
    return rowDifference
  }

  const elevationDifference = (left.elevation ?? 0) - (right.elevation ?? 0)

  if (elevationDifference !== 0) {
    return elevationDifference
  }

  return left.coordinate.q - right.coordinate.q
}
