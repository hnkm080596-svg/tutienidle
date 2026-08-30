import { describe, expect, it } from 'vitest'
import { buildings } from '@/data/building/buildings'
import {
  DONG_FU_BUILDING_ART,
  dongFuBuildingAssetUrls,
  dongFuBuildingTimeClass,
  dongFuSeasonOverlayUrl,
} from './DongFuBuildingArt'

describe('DongFuBuildingArt', () => {
  it('defines exactly five stable building IDs in scene depth order', () => {
    expect(DONG_FU_BUILDING_ART.map((entry) => entry.buildingId)).toEqual([
      'pill_room',
      'gathering_outpost',
      'teleport_array',
      'equipment_hall',
      'spirit_spring',
    ])
    expect(new Set(DONG_FU_BUILDING_ART.map((entry) => entry.scenePlacement.zIndex)).size).toBe(5)
  })

  it('maps every building to aligned V2 technical assets', () => {
    for (const entry of DONG_FU_BUILDING_ART) {
      expect(dongFuBuildingAssetUrls(entry)).toEqual({
        base: `/assets/buildings/dong-fu/v2/${entry.buildingId}/base.png`,
        silhouetteMask: `/assets/buildings/dong-fu/v2/${entry.buildingId}/silhouette-mask.png`,
        groundShadow: `/assets/buildings/dong-fu/v2/${entry.buildingId}/ground-shadow.png`,
        lockedOverlay: `/assets/buildings/dong-fu/v2/${entry.buildingId}/locked-overlay.png`,
      })
    }
  })

  it('stores measured alpha geometry and future VFX anchors', () => {
    for (const entry of DONG_FU_BUILDING_ART) {
      expect(entry.visualBounds.width).toBeLessThanOrEqual(entry.canvas.width)
      expect(entry.visualBounds.height).toBeLessThan(entry.canvas.height)
      expect(entry.baselineY).toBe(entry.visualBounds.y + entry.visualBounds.height)
      expect(Object.keys(entry.futureVfxAnchors)).toEqual([
        'entrance',
        'roof',
        'functionCore',
      ])
    }
  })

  it('maps shared season and time presentation without building variants', () => {
    expect(dongFuSeasonOverlayUrl('winter')).toBe(
      '/assets/buildings/dong-fu/v2/shared/seasons/winter.png',
    )
    expect(dongFuBuildingTimeClass('night')).toBe('is-time-night')
  })

  it('uses the approved Khai Vật Đường display name without changing its ID', () => {
    expect(buildings.find((entry) => entry.id === 'gathering_outpost')?.name).toBe('Khai Vật Đường')
  })
})
