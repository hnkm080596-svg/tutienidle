import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const effectId = 'fx_hoa_cau_triple_fire_circle'
const rotationEnd = 1.74
const peakTime = 2.04
const duration = 2.28
const characters = [...'炎焰熾煉煌燼炬灼焚燦']

function seededCharacters(count, seed) {
  let state = seed
  return Array.from({ length: count }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return characters[state % characters.length]
  })
}

function ringSvg({ outer, inner, color, count, seed, fontSize }) {
  const center = (outer + inner) / 2
  const rimInset = 3.5
  const rimWidth = 6
  const glyphs = seededCharacters(count, seed).map((character, index) => {
    const angle = (index * 360) / count
    return `<text x="128" y="${(128 - center + fontSize * 0.35).toFixed(2)}" transform="rotate(${angle.toFixed(3)} 128 128)" text-anchor="middle" fill="${color}" font-family="SimSun, Noto Serif CJK SC, serif" font-size="${fontSize}" font-weight="700">${character}</text>`
  }).join('')
  const diamonds = [0, 90, 180, 270].map(angle => `<path d="M128 ${128 - center - 5} l4 5 -4 5 -4 -5z" transform="rotate(${angle} 128 128)" fill="none" stroke="${color}" stroke-width="1"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><g fill="none" stroke="${color}" stroke-opacity="0.5"><circle cx="128" cy="128" r="${outer - rimInset}" stroke-width="${rimWidth}"/><circle cx="128" cy="128" r="${inner + rimInset}" stroke-width="${rimWidth}"/></g>${diamonds}${glyphs}</svg>`
}

const rings = [
  { name: 'outer', outer: 115, inner: 87, color: '#ff5830', litColor: '#ffb071', count: 24, seed: 917, fontSize: 22, revealStart: 0.56, speed: 35.15625 },
  { name: 'middle', outer: 86, inner: 58, color: '#ff9b3d', litColor: '#ffe28d', count: 16, seed: 541, fontSize: 21, revealStart: 0.38, speed: -28.125 },
  { name: 'inner', outer: 57, inner: 29, color: '#fff4c6', litColor: '#fffde0', count: 10, seed: 283, fontSize: 19, revealStart: 0.20, speed: 22.5 },
]

function glyphSvg(ring, index) {
  const character = seededCharacters(ring.count, ring.seed)[index]
  const angle = (index * 360) / ring.count
  const center = (ring.outer + ring.inner) / 2
  const y = (128 - center + ring.fontSize * 0.35).toFixed(2)
  const common = `x="128" y="${y}" transform="rotate(${angle.toFixed(3)} 128 128)" text-anchor="middle" font-family="SimSun, Noto Serif CJK SC, serif" font-size="${ring.fontSize}" font-weight="900"`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><text ${common} fill="none" stroke="${ring.litColor}" stroke-width="3.2" stroke-opacity="0.48" stroke-linejoin="round">${character}</text><text ${common} fill="${ring.litColor}" stroke="#fff6d2" stroke-width="0.65" stroke-opacity="0.96">${character}</text></svg>`
}

function calligraphySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="ink" x1="0" y1="0" x2="0.4" y2="1"><stop stop-color="#fff4c4"/><stop offset="0.55" stop-color="#ffd47a"/><stop offset="1" stop-color="#f37334"/></linearGradient></defs><g fill="url(#ink)" stroke="#802119" stroke-width="2" stroke-linejoin="round"><path d="M82 76 C84 88 72 99 68 111 C66 119 70 125 76 126 C91 119 99 105 97 96 C95 86 88 79 82 76 Z"/><path d="M169 74 C167 92 177 106 191 115 C197 113 198 107 192 101 C183 93 177 83 169 74 Z"/><path d="M127 53 C136 70 137 90 132 111 C126 141 108 167 79 190 C70 197 63 199 55 205 C77 204 95 197 111 185 C139 165 151 135 149 108 C148 84 139 64 127 53 Z"/><path d="M139 117 C145 144 159 171 178 190 C189 201 201 205 210 203 C184 188 167 168 154 142 C148 128 144 120 139 117 Z"/></g><path d="M99 174 C86 186 75 190 66 194" fill="none" stroke="#fff5d2" stroke-width="3" stroke-linecap="round" opacity="0.7"/></svg>`
}

const svgSources = () => ({
  tex_hc_outer_ring: ringSvg(rings[0]),
  tex_hc_middle_ring: ringSvg(rings[1]),
  tex_hc_inner_ring: ringSvg(rings[2]),
  tex_hc_calligraphy: calligraphySvg(),
  ...Object.fromEntries(rings.flatMap(ring => Array.from({ length: ring.count }, (_, index) => [
    `tex_hc_${ring.name}_glyph_${String(index + 1).padStart(2, '0')}`,
    glyphSvg(ring, index),
  ]))),
})

const track = keys => ({ keys: keys.map(([t, v]) => ({ t, v })) })

function ringLayer(id, name, textureId, revealStart, degreesPerSecond, peakOpacity) {
  const endAngle = (rotationEnd - revealStart) * degreesPerSecond
  return {
    id,
    name,
    type: 'sprite',
    start: 0,
    end: duration,
    blend: 'normal',
    opacity: track([[0, 0], [revealStart, 0], [revealStart + 0.18, peakOpacity], [rotationEnd, peakOpacity], [peakTime, 0]]),
    sp: {
      sprite: { kind: 'tex', texId: textureId },
      size: 256,
      rot: track([[0, 0], [revealStart, 0], [rotationEnd, endAngle], [duration, endAngle]]),
      glow: 0.12,
      glowSize: 1.08,
      glowBlur: 0.18,
    },
  }
}

function glyphLayers(ring, textureIds) {
  const endAngle = (rotationEnd - ring.revealStart) * ring.speed
  const rotation = track([[0, 0], [ring.revealStart, 0], [rotationEnd, endAngle], [duration, endAngle]])
  const sweepStart = ring.revealStart + 0.20
  const sweepEnd = peakTime - 0.14
  const dissolveStart = { outer: 2.04, middle: 2.08, inner: 2.12 }[ring.name]
  const dissolveEnd = { outer: 2.16, middle: 2.20, inner: 2.24 }[ring.name]
  return Array.from({ length: ring.count }, (_, index) => {
    const indexTag = String(index + 1).padStart(2, '0')
    const sweepIndex = ring.speed >= 0 ? index : (ring.count - index) % ring.count
    const ignition = sweepStart + (sweepEnd - sweepStart) * sweepIndex / (ring.count - 1)
    const full = Math.min(peakTime, ignition + 0.09)
    return {
      id: `lr_hc_${ring.name}_glyph_${indexTag}`,
      name: `${ring.name} fire-script glyph ${indexTag}`,
      type: 'sprite',
      start: 0,
      end: duration,
      blend: 'add',
      glowL: 0.55,
      glowLR: 4,
      opacity: track([[0, 0], [ignition, 0], [full, 0.9], [dissolveStart, 0.9], [dissolveEnd, 0], [duration, 0]]),
      sp: {
        sprite: { kind: 'tex', texId: textureIds[`tex_hc_${ring.name}_glyph_${indexTag}`] },
        size: 256,
        rot: rotation,
      },
    }
  })
}

function circularPath(radius) {
  return Array.from({ length: 12 }, (_, index) => {
    const angle = index * Math.PI / 6
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
  })
}

function orbitingGlints({ id, name, revealStart, radius, seed, flow, rate, size, glow, colors, sprite }) {
  return {
    id,
    name,
    type: 'emitter',
    start: revealStart,
    end: rotationEnd,
    blend: 'add',
    opacity: track([[0, 0], [0.08, 0.92], [rotationEnd - revealStart, 0.92], [peakTime - revealStart, 0]]),
    em: {
      x: 0, y: 0, shape: 'point', dir: 'omni', speed: 0, speedRnd: 0,
      rate, bursts: [], seed, subStep: true,
      path: {
        on: true, mode: 'both', closed: true, smooth: true,
        nodes: circularPath(radius), along: 'even', jitter: 0.8,
        aim: 'tangent', attract: 1.5, lock: 0.92, flow,
      },
    },
    pt: {
      life: 0.62, lifeRnd: 0.2,
      sprite: { kind: 'shape', id: sprite, p: {} },
      size, sizeRnd: 0.35,
      sizeOL: { pts: [{ t: 0, v: 0.45 }, { t: 0.35, v: 1 }, { t: 1, v: 0.2 }] },
      opacityOL: { pts: [{ t: 0, v: 0 }, { t: 0.24, v: 0.86 }, { t: 0.68, v: 0.76 }, { t: 1, v: 0 }] },
      grad: { stops: [{ t: 0, c: colors[0] }, { t: 0.5, c: colors[1] }, { t: 1, c: colors[2] }] },
      drag: 0.4, glow, glowSize: 1.35, glowBlur: 0.15,
    },
  }
}

function flowingFire({ id, name, revealStart, radius, seed, flow, rate, colors }) {
  return {
    id,
    name,
    type: 'emitter',
    start: revealStart,
    end: rotationEnd,
    blend: 'add',
    opacity: track([[0, 0], [0.12, 0.92], [rotationEnd - revealStart, 0.92], [peakTime - revealStart, 0]]),
    glowL: 0.32,
    glowLR: 7,
    em: {
      x: 0, y: 0, shape: 'point', dir: 'omni', speed: 0, speedRnd: 0,
      rate, bursts: [], seed, subStep: true,
      path: {
        on: true, mode: 'both', closed: true, smooth: true,
        nodes: circularPath(radius), along: 'even', jitter: 0.25,
        aim: 'tangent', attract: 2, lock: 0.96, flow,
      },
    },
    pt: {
      life: 0.44, lifeRnd: 0.14, render: 'trail', trailCore: 0.3,
      sprite: { kind: 'shape', id: 'streak', p: {} },
      size: 3.2, sizeRnd: 0.2,
      sizeOL: { pts: [{ t: 0, v: 0.5 }, { t: 0.25, v: 1 }, { t: 1, v: 0.7 }] },
      sizeOT: { pts: [{ t: 0, v: 0.08 }, { t: 0.55, v: 0.65 }, { t: 1, v: 1 }] },
      opacityOL: { pts: [{ t: 0, v: 0 }, { t: 0.22, v: 0.9 }, { t: 0.7, v: 0.85 }, { t: 1, v: 0 }] },
      grad: { stops: [{ t: 0, c: colors[0] }, { t: 0.55, c: colors[1] }, { t: 1, c: colors[2] }] },
      drag: 0.25, glow: 0.28, glowSize: 1.25, glowBlur: 0.12,
    },
  }
}

function centerEmber() {
  return {
    id: 'lr_hc_center_ember',
    name: 'Breathing ember behind fire seal',
    type: 'sprite',
    start: 0,
    end: duration,
    blend: 'screen',
    opacity: track([[0, 0], [0.20, 0.08], [0.62, 0.2], [1.15, 0.13], [1.58, 0.22], [rotationEnd, 0.2], [peakTime, 0]]),
    sp: { sprite: { kind: 'shape', id: 'soft', p: {} }, size: 52, color: [255, 110, 35], glow: 0 },
  }
}

function centerFire() {
  return {
    id: 'lr_hc_center_fire',
    name: 'Contained fire moving behind calligraphy',
    type: 'emitter',
    start: 0.20,
    end: rotationEnd,
    blend: 'add',
    opacity: track([[0, 0], [0.16, 0.84], [1.18, 0.84], [1.54, 0.9], [peakTime - 0.20, 0]]),
    glowL: 0.2,
    glowLR: 6,
    em: {
      x: 0, y: 0, shape: 'point', dir: 'omni', speed: 0, speedRnd: 0,
      rate: 28, bursts: [], seed: 2405, subStep: true,
      path: {
        on: true, mode: 'both', closed: true, smooth: true,
        nodes: circularPath(17), along: 'even', jitter: 1,
        aim: 'tangent', attract: 2, lock: 0.9, flow: 68,
      },
    },
    pt: {
      life: 0.42, lifeRnd: 0.25,
      sprite: { kind: 'shape', id: 'flame', p: { taper: 0.45 } },
      size: 14, sizeRnd: 0.3,
      sizeOL: { pts: [{ t: 0, v: 0.35 }, { t: 0.4, v: 1 }, { t: 1, v: 0.15 }] },
      opacityOL: { pts: [{ t: 0, v: 0 }, { t: 0.28, v: 0.62 }, { t: 0.7, v: 0.48 }, { t: 1, v: 0 }] },
      grad: { stops: [{ t: 0, c: [255, 249, 214] }, { t: 0.5, c: [255, 176, 63] }, { t: 1, c: [230, 77, 28] }] },
      alignVel: true, stretch: 0.6, drag: 0.7,
      glow: 0.25, glowSize: 1.3, glowBlur: 0.14,
    },
  }
}

function ambientEmbers() {
  return {
    id: 'lr_hc_ambient_embers',
    name: 'Faint embers at outer seal',
    type: 'emitter',
    start: 0.56,
    end: 1.72,
    blend: 'screen',
    opacity: track([[0, 0], [0.14, 0.46], [1.16, 0.46], [1.48, 0]]),
    em: {
      x: 0, y: 0, shape: 'ring', sx: 119, sy: 3,
      dir: 'out', speed: 5, speedRnd: 0.5,
      rate: 9, bursts: [], seed: 1209, subStep: true,
    },
    pt: {
      life: 0.38, lifeRnd: 0.25,
      sprite: { kind: 'shape', id: 'ember', p: {} },
      size: 4, sizeRnd: 0.3,
      sizeOL: { pts: [{ t: 0, v: 0.55 }, { t: 0.4, v: 1 }, { t: 1, v: 0.2 }] },
      opacityOL: { pts: [{ t: 0, v: 0 }, { t: 0.3, v: 0.55 }, { t: 1, v: 0 }] },
      grad: { stops: [{ t: 0, c: [255, 202, 101] }, { t: 0.55, c: [239, 111, 61] }, { t: 1, c: [156, 40, 34] }] },
      drag: 1.5, glow: 0.28, glowSize: 1.3, glowBlur: 0.12,
    },
  }
}

function dissolutionEmbers({ ring, start, radius, seed, colors }) {
  return {
    id: `lr_hc_${ring}_dissolve`,
    name: `${ring} fire-script dissolution embers`,
    type: 'emitter',
    start,
    end: start + 0.01,
    blend: 'add',
    opacity: 0.72,
    em: {
      x: 0, y: 0, shape: 'ring', sx: radius, sy: 2,
      dir: 'out', speed: 22, speedRnd: 0.35,
      rate: 0, bursts: [{ t: 0, n: 8 }], seed, subStep: true,
    },
    pt: {
      life: 0.10, lifeRnd: 0.15,
      sprite: { kind: 'shape', id: 'ember', p: {} },
      size: 3.4, sizeRnd: 0.28,
      sizeOL: { pts: [{ t: 0, v: 1 }, { t: 1, v: 0.15 }] },
      opacityOL: { pts: [{ t: 0, v: 0.75 }, { t: 1, v: 0 }] },
      grad: { stops: [{ t: 0, c: colors[0] }, { t: 1, c: colors[1] }] },
      drag: 2, glow: 0.22, glowSize: 1.15, glowBlur: 0.1,
    },
  }
}

export function buildTripleFireCircle() {
  const svgs = svgSources()
  const textureIds = Object.fromEntries(Object.entries(svgs).map(([id, svg]) => [
    id,
    `${id}_${createHash('sha256').update(svg).digest('hex').slice(0, 12)}`,
  ]))
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      id: effectId,
      name: 'Hoa Cau Triple Fire Circle',
      comp: { w: 256, h: 256, dur: duration, fps: 60 },
      exp: { cols: 8, rows: 8, frames: 64, cellW: 192, cellH: 192, t0: 0, t1: duration, mode: 'rgba', ss: 2 },
      textures: Object.keys(svgs).map(id => ({ id: textureIds[id], name: id.replace(/^tex_hc_/, '').replaceAll('_', ' '), sheet: null })),
      layers: [
        dissolutionEmbers({ ring: 'outer', start: 2.05, radius: 101, seed: 2917, colors: [[255, 174, 95], [193, 49, 34]] }),
        dissolutionEmbers({ ring: 'middle', start: 2.10, radius: 72, seed: 2541, colors: [[255, 221, 132], [238, 94, 36]] }),
        dissolutionEmbers({ ring: 'inner', start: 2.14, radius: 43, seed: 2331, colors: [[255, 249, 205], [252, 143, 60]] }),
        orbitingGlints({ id: 'lr_hc_inner_glints', name: 'White-hot inner orbit glints', revealStart: 0.20, radius: 43, seed: 331, flow: 38, rate: 22, size: 8, glow: 0.46, sprite: 'spark', colors: [[255, 251, 224], [255, 235, 154], [255, 171, 82]] }),
        orbitingGlints({ id: 'lr_hc_middle_glints', name: 'Amber counter-orbit glints', revealStart: 0.38, radius: 72, seed: 541, flow: -45, rate: 19, size: 8, glow: 0.42, sprite: 'spark', colors: [[255, 238, 169], [255, 171, 68], [226, 88, 39]] }),
        orbitingGlints({ id: 'lr_hc_outer_glints', name: 'Crimson outer orbit glints', revealStart: 0.56, radius: 101, seed: 917, flow: 52, rate: 17, size: 8, glow: 0.40, sprite: 'spark', colors: [[255, 187, 96], [249, 103, 60], [179, 48, 44]] }),
        flowingFire({ id: 'lr_hc_inner_energy', name: 'White fire current inside inner circle', revealStart: 0.20, radius: 43, seed: 1331, flow: 130, rate: 8, colors: [[255, 255, 231], [255, 233, 150], [255, 162, 65]] }),
        flowingFire({ id: 'lr_hc_middle_energy', name: 'Amber fire current inside middle circle', revealStart: 0.38, radius: 72, seed: 1541, flow: -162.5, rate: 7, colors: [[255, 240, 182], [255, 159, 50], [240, 91, 32]] }),
        flowingFire({ id: 'lr_hc_outer_energy', name: 'Vermilion fire current inside outer circle', revealStart: 0.56, radius: 101, seed: 1917, flow: 203.125, rate: 6, colors: [[255, 199, 122], [255, 99, 49], [213, 51, 34]] }),
        ...rings.flatMap(ring => glyphLayers(ring, textureIds)),
        ambientEmbers(),
        {
          id: 'lr_hc_calligraphy',
          name: 'Calligraphic fire character',
          type: 'sprite',
          start: 0,
          end: duration,
          blend: 'normal',
          opacity: track([[0, 0], [0.08, 0.08], [0.20, 0.26], [0.8, 0.46], [1.4, 0.68], [rotationEnd, 0.82], [2.02, 0.99], [peakTime, 1], [2.15, 1], [2.26, 0], [duration, 0]]),
          sp: { sprite: { kind: 'tex', texId: textureIds.tex_hc_calligraphy }, size: 68, rot: 0 },
        },
        centerFire(),
        centerEmber(),
        ringLayer('lr_hc_inner_ring', 'Inner clockwise gold script', textureIds.tex_hc_inner_ring, 0.20, 22.5, 0.62),
        ringLayer('lr_hc_middle_ring', 'Middle counterclockwise amber script', textureIds.tex_hc_middle_ring, 0.38, -28.125, 0.56),
        ringLayer('lr_hc_outer_ring', 'Outer clockwise vermilion script', textureIds.tex_hc_outer_ring, 0.56, 35.15625, 0.5),
      ],
    },
    tex: Object.fromEntries(Object.entries(svgs).map(([id, svg]) => [textureIds[id], `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`])),
  }
}

const sourceFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === sourceFile) {
  const target = process.argv[2]
  if (!target) throw new Error('Pass the Arcadia library JSON path')
  const absoluteTarget = resolve(target)
  if (existsSync(absoluteTarget)) {
    const current = JSON.parse(readFileSync(absoluteTarget, 'utf8'))
    if (current.doc?.id !== effectId) throw new Error(`Refusing to overwrite another effect: ${current.doc?.id}`)
  }
  const effect = buildTripleFireCircle()
  writeFileSync(absoluteTarget, `${JSON.stringify(effect, null, 2)}\n`)
  const sourceDir = dirname(sourceFile)
  const filenames = {
    tex_hc_outer_ring: 'fire-circle-outer.svg',
    tex_hc_middle_ring: 'fire-circle-middle.svg',
    tex_hc_inner_ring: 'fire-circle-inner.svg',
    tex_hc_calligraphy: 'fire-character-calligraphy.svg',
  }
  const svgs = svgSources()
  for (const [id, filename] of Object.entries(filenames)) {
    const svg = svgs[id]
    writeFileSync(join(sourceDir, filename), `${svg}\n`)
  }
}
