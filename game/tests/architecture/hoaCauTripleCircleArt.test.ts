import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'
import { describe, expect, it } from 'vitest'

const gameRoot = fileURLToPath(new URL('../../', import.meta.url))
const source = `${gameRoot}/art/vfx/hoa-cau-thuat/Hoa Cau Triple Fire Circle.json`
const circleDir = `${gameRoot}/public/assets/vfx/hoa-cau-thuat/circle`
const RINGS = ['inner', 'middle', 'outer'] as const

describe('Arcadia fire circle per-ring exports', () => {
  it('splits the editable 2.28-second circle into three transparent 64-frame atlases', async () => {
    const effect = JSON.parse(readFileSync(source, 'utf8'))
    expect(effect.doc.id).toBe('fx_hoa_cau_triple_fire_circle')
    expect(effect.doc.comp.dur).toBe(2.28)
    expect(effect.doc.exp.mode).toBe('rgba')

    for (const ring of RINGS) {
      const data = JSON.parse(readFileSync(`${circleDir}/hoa-cau-fire-circle-${ring}.json`, 'utf8'))
      const image = await loadImage(`${circleDir}/hoa-cau-fire-circle-${ring}.png`)
      const canvas = createCanvas(image.width, image.height)
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)

      expect(data.meta).toMatchObject({ app: 'arcadia-effects', durationMs: 2280,
        frameCount: 64, transparent: true })
      expect(Object.keys(data.frames)).toHaveLength(64)
      expect([image.width, image.height]).toEqual([1536, 1536])
      expect(context.getImageData(0, 0, 1, 1).data[3]).toBe(0)
      // Frame 22 (t ~0.78s) sits past every ring's authored reveal window
      // (inner 0.20, middle 0.38, outer 0.56 + 0.18 ramp).
      for (const index of [22, 40, 57]) {
        const { x, y, w, h } = data.frames[`frame_${index}`].frame
        const pixels = context.getImageData(x, y, w, h).data
        let lit = 0
        for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset]! > 20) lit++
        expect(lit).toBeGreaterThan(100)
      }
    }
  })

  it('renders each ring at its own authored radius - inner smallest, outer largest', async () => {
    // Peak frame 57 (t ~2.03s): every ring is fully revealed, so the lit
    // bounding box must sit inside its authored annulus (comp r 29-57,
    // 58-86, 87-115 scaled to the 192px cell).
    const bounds = { inner: [56, 136], middle: [33, 159], outer: [11, 181] } as const
    for (const ring of RINGS) {
      const data = JSON.parse(readFileSync(`${circleDir}/hoa-cau-fire-circle-${ring}.json`, 'utf8'))
      const image = await loadImage(`${circleDir}/hoa-cau-fire-circle-${ring}.png`)
      const canvas = createCanvas(image.width, image.height)
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      const { x, y, w, h } = data.frames['frame_57'].frame
      const pixels = context.getImageData(x, y, w, h)
      let minX = w, minY = h, maxX = 0, maxY = 0
      for (let py = 0; py < h; py += 1) {
        for (let px = 0; px < w; px += 1) {
          if (pixels.data[(py * w + px) * 4 + 3]! > 20) {
            if (px < minX) minX = px
            if (px > maxX) maxX = px
            if (py < minY) minY = py
            if (py > maxY) maxY = py
          }
        }
      }
      const [lo, hi] = bounds[ring]
      expect(minX).toBeGreaterThanOrEqual(lo - 2)
      expect(maxX).toBeLessThanOrEqual(hi + 2)
      expect(minY).toBeGreaterThanOrEqual(lo - 2)
      expect(maxY).toBeLessThanOrEqual(hi + 2)
    }
  })
})
