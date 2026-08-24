import { getHexDistance, hexCoordinateKey } from './HexCoordinate'
import type { WorldMapDefinition, WorldMapSpriteDefinition } from './WorldMap'

export type WorldMapValidationCode =
  | 'duplicate_sprite_id'
  | 'invalid_sprite_source'
  | 'duplicate_tile_id'
  | 'duplicate_coordinate'
  | 'unknown_sprite'
  | 'duplicate_stage'
  | 'unknown_stage'
  | 'missing_stage'
  | 'non_adjacent_stage'

export interface WorldMapValidationIssue {
  code: WorldMapValidationCode
  message: string
}

export interface WorldMapValidationOptions {
  /** All stage ids registered by the game. */
  validStageIds?: ReadonlySet<string>
  /** Ordered stage ids that this map must contain. */
  requiredStageIds?: readonly string[]
  /** Require consecutive required stages to occupy neighboring hexes. */
  requireAdjacentStages?: boolean
}

export function validateWorldMap(
  definition: WorldMapDefinition,
  options: WorldMapValidationOptions = {},
): WorldMapValidationIssue[] {
  const issues: WorldMapValidationIssue[] = []
  const spriteIds = new Set<string>()

  for (const sprite of definition.sprites) {
    if (spriteIds.has(sprite.id)) {
      issues.push(issue('duplicate_sprite_id', `Duplicate sprite id: ${sprite.id}`))
    } else {
      spriteIds.add(sprite.id)
    }

    if (!isValidSpriteSource(sprite)) {
      issues.push(issue('invalid_sprite_source', `Invalid source for sprite: ${sprite.id}`))
    }
  }

  const tileIds = new Set<string>()
  const coordinateKeys = new Set<string>()
  const stageTiles = new Map<string, WorldMapDefinition['tiles'][number]>()

  for (const tile of definition.tiles) {
    if (tileIds.has(tile.id)) {
      issues.push(issue('duplicate_tile_id', `Duplicate tile id: ${tile.id}`))
    } else {
      tileIds.add(tile.id)
    }

    const coordinateKey = hexCoordinateKey(tile.coordinate)

    if (coordinateKeys.has(coordinateKey)) {
      issues.push(issue('duplicate_coordinate', `Duplicate tile coordinate: ${coordinateKey}`))
    } else {
      coordinateKeys.add(coordinateKey)
    }

    for (const spriteId of [tile.spriteId, ...(tile.overlaySpriteIds ?? [])]) {
      if (!spriteIds.has(spriteId)) {
        issues.push(issue('unknown_sprite', `Tile ${tile.id} references unknown sprite: ${spriteId}`))
      }
    }

    if (!tile.stageId) {
      continue
    }

    if (stageTiles.has(tile.stageId)) {
      issues.push(issue('duplicate_stage', `Stage appears on multiple tiles: ${tile.stageId}`))
    } else {
      stageTiles.set(tile.stageId, tile)
    }

    if (options.validStageIds && !options.validStageIds.has(tile.stageId)) {
      issues.push(issue('unknown_stage', `Tile ${tile.id} references unknown stage: ${tile.stageId}`))
    }
  }

  const requiredStageIds = options.requiredStageIds ?? []

  for (const stageId of requiredStageIds) {
    if (!stageTiles.has(stageId)) {
      issues.push(issue('missing_stage', `Map is missing required stage: ${stageId}`))
    }
  }

  if (options.requireAdjacentStages) {
    for (let index = 1; index < requiredStageIds.length; index++) {
      const previousStageId = requiredStageIds[index - 1]
      const stageId = requiredStageIds[index]

      if (!previousStageId || !stageId) {
        continue
      }

      const previousTile = stageTiles.get(previousStageId)
      const tile = stageTiles.get(stageId)

      if (previousTile && tile && getHexDistance(previousTile.coordinate, tile.coordinate) !== 1) {
        issues.push(issue(
          'non_adjacent_stage',
          `Consecutive stages are not adjacent: ${previousStageId} -> ${stageId}`,
        ))
      }
    }
  }

  return issues
}

function isValidSpriteSource(sprite: WorldMapSpriteDefinition): boolean {
  if (sprite.source.url.trim().length === 0) {
    return false
  }

  if (sprite.source.kind === 'image') {
    return true
  }

  const { frame } = sprite.source

  return frame.x >= 0
    && frame.y >= 0
    && frame.width > 0
    && frame.height > 0
}

function issue(code: WorldMapValidationCode, message: string): WorldMapValidationIssue {
  return { code, message }
}
