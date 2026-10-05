import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'
import { describe, expect, it } from 'vitest'

const gameRoot = fileURLToPath(new URL('../../', import.meta.url))
const source = `${gameRoot}/art/vfx/hoa-cau-thuat/Hoa Cau Triple Fire Circle.json`
const atlas = `${gameRoot}/public/assets/vfx/hoa-cau-thuat/circle/hoa-cau-triple-fire-circle.png`
const metadata = `${gameRoot}/public/assets/vfx/hoa-cau-thuat/circle/hoa-cau-triple-fire-circle.json`

describe('Arcadia triple fire circle preview export', () => {
  it('plays the editable 2.28-second circle as a transparent 64-frame atlas', async () => {
    const effect = JSON.parse(readFileSync(source, 'utf8'))
    const data = JSON.parse(readFileSync(metadata, 'utf8'))
    const image = await loadImage(atlas)
    const canvas = createCanvas(image.width, image.height)
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)

    expect(effect.doc.id).toBe('fx_hoa_cau_triple_fire_circle')
    expect(effect.doc.comp.dur).toBe(2.28)
    expect(effect.doc.exp.mode).toBe('rgba')
    expect(data.meta).toMatchObject({ app: 'arcadia-effects', durationMs: 2280,
      frameCount: 64, transparent: true })
    expect(Object.keys(data.frames)).toHaveLength(64)
    expect([image.width, image.height]).toEqual([1536, 1536])
    expect(context.getImageData(0, 0, 1, 1).data[3]).toBe(0)
    for (const index of [10, 30, 55]) {
      const { x, y, w, h } = data.frames[`frame_${index}`].frame
      const pixels = context.getImageData(x, y, w, h).data
      let lit = 0
      for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset]! > 20) lit++
      expect(lit).toBeGreaterThan(100)
    }
  })
})
