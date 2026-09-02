// @vitest-environment node
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { readFileSync, readdirSync } from 'node:fs'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DONG_FU_BUILDING_ART,
  dongFuBuildingAssetUrls,
  dongFuSeasonOverlayUrl,
} from '@/game/support/DongFuBuildingArt'

const runtimeFiles = DONG_FU_BUILDING_ART.flatMap((entry) =>
  Object.values(dongFuBuildingAssetUrls(entry)).map((url) => ({ entry, url })),
)
const seasons = ['spring', 'summer', 'autumn', 'winter'] as const
const technicalNames = ['base.png', 'ground-shadow.png', 'locked-overlay.png', 'silhouette-mask.png']

// Flaky fix (2026-09-02, user-approved): alpha-bounds test (spawn 6
// ImageMagick processes decoding 1254×1254 PNGs) REMOVED — dưới tải
// full suite nó vượt timeout 5s không deterministic. Trách nhiệm
// "asset khớp geometry đã đăng ký" thuộc về pipeline test
// (dongFuBuildingPipeline.test.ts — nơi asset được tạo ra, timeout 180s).
// Test 1+3 giữ lại: thuần fs read, vẫn chặn PNG sai kích thước/kênh.

describe('Dong Fu building V2 assets', () => {
  it('contains exactly twenty-four aligned RGBA technical PNGs', () => {
    expect(DONG_FU_BUILDING_ART).toHaveLength(6)
    expect(runtimeFiles).toHaveLength(24)

    for (const { entry, url } of runtimeFiles) {
      const png = readFileSync(new URL(`../../public${url}`, import.meta.url))

      expect([...png.subarray(0, 8)], url).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ])
      expect(png.readUInt32BE(16), url).toBe(1254)
      expect(png.readUInt32BE(20), url).toBe(1254)
      expect(png[25], url).toBe(6)

      expect(entry.baselineY, entry.buildingId).toBeGreaterThan(entry.visualBounds.y)
      expect(entry.baselineY, entry.buildingId).toBeLessThanOrEqual(
        entry.visualBounds.y + entry.visualBounds.height,
      )
    }

    for (const entry of DONG_FU_BUILDING_ART) {
      const directory = new URL(
        `../../public/assets/buildings/dong-fu/v2/${entry.buildingId}/`,
        import.meta.url,
      )
      expect(
        readdirSync(directory).filter((name: string) => name.endsWith('.png')).sort(),
        entry.buildingId,
      ).toEqual(technicalNames)
    }
  })

  it('contains four aligned RGBA scene-space season overlays', () => {
    for (const season of seasons) {
      const url = dongFuSeasonOverlayUrl(season)
      const png = readFileSync(new URL(`../../public${url}`, import.meta.url))

      expect(png.readUInt32BE(16), url).toBe(1672)
      expect(png.readUInt32BE(20), url).toBe(941)
      expect(png[25], url).toBe(6)
      expect(url).not.toContain('/previews/')
    }


    expect(
      readdirSync(new URL(
        '../../public/assets/buildings/dong-fu/v2/shared/seasons/',
        import.meta.url,
      )).filter((name: string) => name.endsWith('.png')).sort(),
    ).toEqual(seasons.map((season) => `${season}.png`).sort())
  })
})
