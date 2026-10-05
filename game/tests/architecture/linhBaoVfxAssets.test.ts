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

  it('binds the recipe atlas cue to the enumerated asset key and frame count', () => {
    const recipe = getSkillPresentationRecipe('linh_bao_burst')
    const cue = recipe.impact.find(candidate => candidate.primitive === 'atlas')
    expect(cue?.atlas?.key).toBe(LINH_BAO_VFX_ASSETS.burst.key)
    expect(cue?.atlas?.frames).toBe(LINH_BAO_VFX_ASSETS.burst.lastFrame - LINH_BAO_VFX_ASSETS.burst.firstFrame + 1)
    expect(cue?.durationMs).toBe(recipe.impactMs)
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
