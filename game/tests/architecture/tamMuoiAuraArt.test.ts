import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'
import { describe, expect, it } from 'vitest'

const gameRoot = fileURLToPath(new URL('../../', import.meta.url))
const source = `${gameRoot}/art/vfx/hoa-cau-thuat/Tam Muoi Fire Aura.json`
const outputDir = `${gameRoot}/public/assets/vfx/hoa-cau-thuat/tam-muoi-aura`

describe('Tam Muội Arcadia aura preview', () => {
  it('exports editable scrolling fire glyphs as transparent front and back loops', async () => {
    expect(existsSync(source)).toBe(true)
    const effect = JSON.parse(readFileSync(source, 'utf8'))

    expect(effect).toMatchObject({ app: 'arcadia-effects', doc: { id: 'fx_tam_muoi_fire_aura' } })
    expect(effect.doc.exp.mode).toBe('rgba')
    expect(JSON.stringify(effect).toLowerCase()).not.toContain('phap_tu_shared')
    expect(effect.doc.layers.some((layer: { name: string }) => layer.name.startsWith('BACK:'))).toBe(true)
    expect(effect.doc.layers.some((layer: { name: string }) => layer.name.startsWith('FRONT:'))).toBe(true)
    expect(effect.doc.layers.some((layer: { name: string }) => /halo|ring|circle|ankle flames/i.test(layer.name))).toBe(false)
    const svgSources = Object.values(effect.tex).map((uri) => Buffer.from(String(uri).split(',')[1]!, 'base64').toString('utf8'))
    expect(svgSources.some((svg) => /<ellipse\b/.test(svg))).toBe(false)
    expect(svgSources.some((svg) => /<text\b/.test(svg) && /[火炎焰灵气]/.test(svg))).toBe(true)
    const glyphLayers = effect.doc.layers.filter((layer: { name: string }) => /scrolling fire glyphs/.test(layer.name))
    expect(glyphLayers.length).toBeGreaterThanOrEqual(5)
    for (const layer of glyphLayers) {
      const keys = layer.opacity.keys as { t: number; v: number }[]
      const onset = keys.find((key, index) => index > 0 && key.v === 0)!
      const peak = keys.reduce((best, key) => key.v > best.v ? key : best)
      const fadeEnd = keys.find((key) => key.t > peak.t && key.v === 0)!
      expect(peak.v).toBe(1)
      expect(peak.t).toBeCloseTo((onset.t + fadeEnd.t) / 2, 2)
      expect(layer.glowL).toBeGreaterThanOrEqual(0.5)
    }

    for (const pass of ['back', 'front']) {
      const atlas = `${outputDir}/tam-muoi-aura-${pass}.png`
      const metadata = `${outputDir}/tam-muoi-aura-${pass}.json`
      expect(existsSync(atlas)).toBe(true)
      expect(existsSync(metadata)).toBe(true)
      const data = JSON.parse(readFileSync(metadata, 'utf8'))
      const image = await loadImage(atlas)
      const canvas = createCanvas(image.width, image.height)
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      expect(data.meta).toMatchObject({ app: 'arcadia-effects', loop: true, transparent: true, pass })
      expect(Object.keys(data.frames)).toHaveLength(data.meta.frameCount)
      const frame = data.frames.frame_12.frame
      const pixels = context.getImageData(frame.x, frame.y, frame.w, frame.h).data
      const alphaAt = (x: number, y: number) => pixels[(y * frame.w + x) * 4 + 3]
      expect(alphaAt(0, 0)).toBe(0)
      let visiblePixels = 0
      for (let y = 65; y < 245; y++) for (let x = 20; x < 236; x++)
        if (alphaAt(x, y)! > 18) visiblePixels++
      expect(visiblePixels).toBeGreaterThan(60)
    }
  })
})
