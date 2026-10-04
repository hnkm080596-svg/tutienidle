import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from 'canvas'

const gameRoot = fileURLToPath(new URL('../../', import.meta.url))
const source = `${gameRoot}/art/vfx/hoa-cau-thuat/Hoa Tu Charge.json`
const atlas = `${gameRoot}/public/assets/vfx/hoa-cau-thuat/charge/hoa-tu-charge.png`
const meta = `${gameRoot}/public/assets/vfx/hoa-cau-thuat/charge/hoa-tu-charge.json`

describe('Hỏa Cầu Arcadia charge asset', () => {
  it('keeps an editable, timed Arcadia source apart from the RGBA export', async () => {
    const effect = JSON.parse(readFileSync(source, 'utf8'))
    const data = JSON.parse(readFileSync(meta, 'utf8'))
    const image = await loadImage(atlas)
    const canvas = createCanvas(image.width, image.height)
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)

    expect(effect.app).toBe('arcadia-effects')
    expect(effect.doc.id).toBe('fx_hoa_tu_charge')
    expect(effect.doc.comp.dur).toBe(0.55)
    expect(effect.doc.exp.mode).toBe('rgba')
    expect(effect.doc.exp.frames).toBe(18)
    expect(data.meta.durationMs).toBe(550)
    expect(data.meta.releaseMs).toBe(550)
    expect(Object.keys(data.frames)).toHaveLength(18)
    expect(image.width).toBe(1152)
    expect(image.height).toBe(576)
    expect(context.getImageData(0, 0, 1, 1).data[3]).toBe(0)
  })
})
