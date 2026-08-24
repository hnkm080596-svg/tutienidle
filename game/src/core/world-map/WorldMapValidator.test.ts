import { describe, expect, it } from 'vitest'
import type { WorldMapDefinition } from './WorldMap'
import { validateWorldMap } from './WorldMapValidator'

function createMap(): WorldMapDefinition {
  return {
    id: 'test-map',
    zoneId: 'test-zone',
    name: 'Test Map',
    initialCenter: { q: 0, r: 0 },
    sprites: [
      {
        id: 'forest',
        source: { kind: 'image', url: '/assets/world-map/forest.png' },
      },
      {
        id: 'sect',
        source: {
          kind: 'sheet',
          url: '/assets/world-map/tiles.png',
          frame: { x: 0, y: 0, width: 256, height: 256 },
        },
      },
    ],
    tiles: [
      {
        id: 'tile-0',
        coordinate: { q: 0, r: 0 },
        spriteId: 'forest',
        stageId: 'stage-1',
      },
      {
        id: 'tile-1',
        coordinate: { q: 1, r: 0 },
        spriteId: 'forest',
        overlaySpriteIds: ['sect'],
        stageId: 'stage-2',
      },
    ],
  }
}

describe('validateWorldMap', () => {
  it('accepts a complete map with adjacent required stages', () => {
    const issues = validateWorldMap(createMap(), {
      validStageIds: new Set(['stage-1', 'stage-2']),
      requiredStageIds: ['stage-1', 'stage-2'],
      requireAdjacentStages: true,
    })

    expect(issues).toEqual([])
  })

  it('reports duplicate coordinates, missing sprites and invalid stages', () => {
    const map = createMap()

    map.tiles[1] = {
      ...map.tiles[1]!,
      coordinate: { q: 0, r: 0 },
      overlaySpriteIds: ['missing-sprite'],
      stageId: 'unknown-stage',
    }

    const codes = validateWorldMap(map, {
      validStageIds: new Set(['stage-1', 'stage-2']),
      requiredStageIds: ['stage-1', 'stage-2'],
    }).map(issue => issue.code)

    expect(codes).toContain('duplicate_coordinate')
    expect(codes).toContain('unknown_sprite')
    expect(codes).toContain('unknown_stage')
    expect(codes).toContain('missing_stage')
  })

  it('reports duplicate stage assignments and non-adjacent progression', () => {
    const duplicateMap = createMap()
    duplicateMap.tiles[1] = { ...duplicateMap.tiles[1]!, stageId: 'stage-1' }

    expect(validateWorldMap(duplicateMap).map(issue => issue.code)).toContain('duplicate_stage')

    const disconnectedMap = createMap()
    disconnectedMap.tiles[1] = {
      ...disconnectedMap.tiles[1]!,
      coordinate: { q: 3, r: 0 },
    }

    expect(validateWorldMap(disconnectedMap, {
      requiredStageIds: ['stage-1', 'stage-2'],
      requireAdjacentStages: true,
    }).map(issue => issue.code)).toContain('non_adjacent_stage')
  })

  it('rejects empty image urls and invalid sheet frames', () => {
    const map = createMap()

    map.sprites[0] = {
      id: 'forest',
      source: { kind: 'image', url: ' ' },
    }
    map.sprites[1] = {
      id: 'sect',
      source: {
        kind: 'sheet',
        url: '/assets/world-map/tiles.png',
        frame: { x: 0, y: 0, width: 0, height: 256 },
      },
    }

    const invalidSources = validateWorldMap(map)
      .filter(issue => issue.code === 'invalid_sprite_source')

    expect(invalidSources).toHaveLength(2)
  })
})
