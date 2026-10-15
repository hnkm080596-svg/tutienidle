import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from 'canvas'
import { LINH_BAO_VFX_ASSETS } from '../../src/game/support/LinhBaoVfxAssets'
import { getCombatDescriptors } from '../../src/presentation/assets/AssetBundleCatalog'
import { getSkillPresentationRecipe } from '../../src/data/vfx/SkillPresentationRecipes'

const root = fileURLToPath(new URL('../../', import.meta.url))

describe('Linh Bao asset contract', () => {
  it('preloads the burst atlas, with only occupied frame ranges', () => {
    const descriptors = getCombatDescriptors()
    for (const asset of Object.values(LINH_BAO_VFX_ASSETS)) {
      expect(descriptors).toContainEqual({
        kind: 'atlas', key: asset.key, textureUrl: asset.textureUrl, atlasUrl: asset.atlasUrl,
      })
      expect(existsSync(`${root}/public${asset.textureUrl}`)).toBe(true)
      const data = JSON.parse(readFileSync(`${root}/public${asset.atlasUrl}`, 'utf8'))
      expect(Object.keys(data.frames).length).toBeGreaterThanOrEqual(asset.lastFrame - asset.firstFrame + 1)
      expect(data.frames[`frame_${asset.firstFrame}`]).toBeDefined()
      expect(data.frames[`frame_${asset.lastFrame}`]).toBeDefined()
    }
    expect(LINH_BAO_VFX_ASSETS.burst.lastFrame).toBe(11)
  })

  it('uses white authored charge and a scaled procedural explosion instead of the legacy burst atlas', () => {
    const recipe = getSkillPresentationRecipe('linh_bao_burst')
    expect(recipe.color).toBe(0xffffff)
    expect(recipe.cast).toContainEqual(expect.objectContaining({
      primitive: 'atlas', anchor: 'targets', fitCastPhase: true,
      atlas: { key: 'hoa-cau-charge', frames: 51, scale: 1.75, tintFill: 0xffffff, alpha: 0.8 },
    }))
    expect(recipe.impact).toContainEqual(expect.objectContaining({
      primitive: 'burst', anchor: 'targets', shape: 'explosion', scale: 1.3,
      durationMs: recipe.impactMs,
    }))
    expect([...recipe.cast, ...recipe.impact, ...recipe.recovery].some(cue =>
      cue.atlas?.key === LINH_BAO_VFX_ASSETS.burst.key)).toBe(false)
  })

  it('indexes only nonblank frames inside the real PNG', async () => {
    for (const asset of Object.values(LINH_BAO_VFX_ASSETS)) {
      const image = await loadImage(readFileSync(`${root}/public${asset.textureUrl}`))
      const canvas = createCanvas(image.width, image.height)
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      const data = JSON.parse(readFileSync(`${root}/public${asset.atlasUrl}`, 'utf8'))
      for (const entry of Object.values(data.frames) as Array<{ frame: { x: number; y: number; w: number; h: number } }>) {
        const { x, y, w, h } = entry.frame
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x + w).toBeLessThanOrEqual(image.width)
        expect(y + h).toBeLessThanOrEqual(image.height)
        const pixels = context.getImageData(x, y, w, h).data
        let nonblank = false
        for (let offset = 3; offset < pixels.length; offset += 4) {
          if (pixels[offset]! > 5) { nonblank = true; break }
        }
        expect(nonblank, `${asset.key} blank frame at ${x},${y}`).toBe(true)
      }
    }
  })
})
