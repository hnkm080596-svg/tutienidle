import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../', import.meta.url))
const atlasPath = `${root}/public/assets/vfx/hoa-cau-thuat/projectile/hoa-cau-phoenix.png`
const metadataPath = `${root}/public/assets/vfx/hoa-cau-thuat/projectile/hoa-cau-phoenix.json`

describe('Arcadia phoenix projectile export', () => {
  it('keeps transparent 1.2-second active frames with visible fire through the last frame', async () => {
    expect(existsSync(atlasPath)).toBe(true)
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
    expect(metadata.meta).toMatchObject({ app: 'arcadia-effects', durationMs: 1200,
      frameCount: 36, transparent: true })
    const image = await loadImage(readFileSync(atlasPath))
    const canvas = createCanvas(image.width, image.height)
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    for (const index of [0, 17, 35]) {
      const { x, y, w, h } = metadata.frames[`frame_${index}`].frame
      const pixels = context.getImageData(x, y, w, h).data
      let lit = 0
      for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset]! > 20) lit += 1
      expect(lit).toBeGreaterThan(100)
      expect(pixels[3]).toBe(0)
    }
  })

  it('has a long narrow flying silhouette and a smooth active-loop seam', async () => {
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
    const image = await loadImage(readFileSync(atlasPath))
    const canvas = createCanvas(image.width, image.height)
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const frame = (index: number) => {
      const { x, y, w, h } = metadata.frames[`frame_${index}`].frame
      return { pixels: context.getImageData(x, y, w, h).data, w, h }
    }
    const mid = frame(17)
    let minX = mid.w, maxX = 0, minY = mid.h, maxY = 0
    for (let y = 0; y < mid.h; y++) for (let x = 0; x < mid.w; x++) {
      if (mid.pixels[(y * mid.w + x) * 4 + 3]! <= 20) continue
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    expect((maxX - minX) / (maxY - minY)).toBeGreaterThan(1.8)
    expect(frame(35).pixels).toEqual(frame(0).pixels)
    const alphaDifference = (left: number, right: number) => {
      const a = frame(left).pixels, b = frame(right).pixels
      let difference = 0
      for (let offset = 3; offset < a.length; offset += 4) difference += Math.abs(a[offset]! - b[offset]!)
      return difference / (a.length / 4) / 255
    }
    expect(alphaDifference(0, 35)).toBeLessThan(0.005)
    expect(alphaDifference(34, 35)).toBeLessThan(0.012)
  })
})
