import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const duration = 1.2
const track = keys => ({ keys: keys.map(([t, v]) => ({ t, v })) })
const texture = (name, svg) => ({
  id: `tex_tam_muoi_${name}_${createHash('sha256').update(svg).digest('hex').slice(0, 12)}`,
  name: name.replaceAll('_', ' '),
  svg,
})

const fineArc = texture('moving_embers', `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<defs><radialGradient id="ember"><stop stop-color="#fff3bd"/><stop offset=".34" stop-color="#ffb348" stop-opacity=".88"/><stop offset="1" stop-color="#ee461e" stop-opacity="0"/></radialGradient></defs>
<circle cx="128" cy="128" r="15" fill="url(#ember)"/><path d="M128 129 Q122 139 127 146 Q132 138 128 129" fill="#ff8633" fill-opacity=".62"/></svg>`)

function glyphTexture(name, glyphs) {
  const text = [...glyphs].map((glyph, index) =>
    `<text x="${128 + (index % 2 ? 2 : -2)}" y="${143 + index * 29}">${glyph}</text>`).join('')
  return texture(name, `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<g font-family="SimSun" font-size="22" text-anchor="middle" font-weight="bold">
<g fill="none" stroke="#f32a35" stroke-opacity=".55" stroke-width="6" stroke-linejoin="round">${text}</g>
<g fill="#ff7166" stroke="#ffdbbd" stroke-width="0.65" stroke-opacity=".96">${text}</g>
<g fill="#fff0db" fill-opacity=".66" font-size="19">${text}</g>
</g></svg>`)
}

const glyphTextures = [
  glyphTexture('fire_qi_glyphs_one', '火炎灵气'),
  glyphTexture('fire_qi_glyphs_two', '焰炽煌烁'),
  glyphTexture('fire_qi_glyphs_three', '离火赤焰'),
]

function spriteLayer(id, name, tex, opacity, blend = 'add') {
  return { id, name, type: 'sprite', start: 0, end: duration, blend,
    opacity: track(opacity), sp: { sprite: { kind: 'tex', texId: tex.id }, size: 256 } }
}

function glyphLayer(index, pass, tex, x, delay) {
  const end = Math.min(duration, delay + 0.88)
  const midpoint = (delay + end) / 2
  const layer = spriteLayer(`lr_tam_muoi_glyph_${index}`,
    `${pass}: scrolling fire glyphs ${index}`, tex,
    [[0, 0], [delay, 0], [midpoint, 1], [end, 0], [duration, 0]])
  layer.glowL = 0.55
  layer.glowLR = 4
  layer.sp.x = track([[0, x], [duration, x]])
  layer.sp.y = track([[0, 45], [delay, 45], [end, -64], [duration, 45]])
  return layer
}

function ember(index, pass, x, y, delay, size) {
  const t0 = delay
  const t1 = delay + 0.17
  const t2 = delay + 0.47
  const t3 = delay + 0.61
  return {
    id: `lr_tam_muoi_ember_${index}`,
    name: `${pass}: floating fire ember ${index}`,
    type: 'sprite', start: 0, end: duration, blend: 'add',
    opacity: track([[0, 0], [t0, 0], [t1, 0.65], [t2, 0.4], [t3, 0], [duration, 0]]),
    sp: {
      sprite: { kind: 'tex', texId: fineArc.id }, size,
      x: track([[0, x], [t0, x], [t3, x + (index % 2 ? 7 : -6)], [duration, x]]),
      y: track([[0, y], [t0, y], [t3, y - 47], [duration, y]]),
    },
  }
}

export function buildTamMuoiAura() {
  const textures = [fineArc, ...glyphTextures]
  return {
    app: 'arcadia-effects', v: 1,
    doc: {
      id: 'fx_tam_muoi_fire_aura', name: 'Tam Muoi Fire Aura',
      comp: { w: 256, h: 256, dur: duration, fps: 30 },
      exp: { cols: 6, rows: 6, frames: 36, cellW: 256, cellH: 256,
        t0: 0, t1: duration, mode: 'rgba', ss: 2 },
      textures: textures.map(({ id, name }) => ({ id, name, sheet: null })),
      layers: [
        glyphLayer(1, 'BACK', glyphTextures[0], -76, 0.02),
        glyphLayer(2, 'BACK', glyphTextures[1], 72, 0.24),
        glyphLayer(3, 'BACK', glyphTextures[2], -26, 0.38),
        glyphLayer(4, 'FRONT', glyphTextures[1], -51, 0.13),
        glyphLayer(5, 'FRONT', glyphTextures[0], 54, 0.35),
        ember(1, 'BACK', -74, 102, 0.02, 20), ember(2, 'BACK', 69, 112, 0.24, 18),
        ember(3, 'FRONT', -66, 70, 0.45, 14), ember(4, 'FRONT', 81, 85, 0.05, 15),
      ],
    },
    tex: Object.fromEntries(textures.map(({ id, svg }) => [id,
      `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`])),
  }
}

const sourceFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === sourceFile) {
  const target = process.argv[2]
  if (!target) throw new Error('Pass the Arcadia effect JSON path')
  const absoluteTarget = resolve(target)
  if (existsSync(absoluteTarget)) {
    const existing = JSON.parse(readFileSync(absoluteTarget, 'utf8'))
    if (existing.doc?.id !== 'fx_tam_muoi_fire_aura') throw new Error('Refusing to overwrite another Arcadia effect')
  }
  writeFileSync(absoluteTarget, `${JSON.stringify(buildTamMuoiAura(), null, 2)}\n`)
}
