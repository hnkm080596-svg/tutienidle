import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from 'canvas'
import { HOA_CAU_VFX_ASSETS } from '../../src/game/support/HoaCauVfxAssets'
import { getCombatDescriptors } from '../../src/presentation/assets/AssetBundleCatalog'

const root = fileURLToPath(new URL('../../', import.meta.url))

describe('Hỏa Cầu asset contract', () => {
  it('preloads all six atlases, with only occupied frame ranges', () => {
    const descriptors = getCombatDescriptors()
    for (const asset of Object.values(HOA_CAU_VFX_ASSETS)) {
      expect(descriptors).toContainEqual({
        kind: 'atlas', key: asset.key, textureUrl: asset.textureUrl, atlasUrl: asset.atlasUrl,
      })
      expect(existsSync(`${root}/public${asset.textureUrl}`)).toBe(true)
      const data = JSON.parse(readFileSync(`${root}/public${asset.atlasUrl}`, 'utf8'))
      expect(Object.keys(data.frames).length).toBeGreaterThanOrEqual(asset.lastFrame - asset.firstFrame + 1)
      expect(data.frames[`frame_${asset.firstFrame}`]).toBeDefined()
      expect(data.frames[`frame_${asset.lastFrame}`]).toBeDefined()
    }
    expect(HOA_CAU_VFX_ASSETS.projectile.textureUrl).toContain('火 (9).png')
    expect(HOA_CAU_VFX_ASSETS.impact.textureUrl).toContain('火 (20).png')
    expect(HOA_CAU_VFX_ASSETS.projectile.lastFrame).toBe(26)
    expect(HOA_CAU_VFX_ASSETS.impact.lastFrame).toBe(26)
  })

  it('indexes only nonblank frames inside each real PNG', async () => {
    for (const asset of Object.values(HOA_CAU_VFX_ASSETS)) {
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
