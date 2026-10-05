import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Hoa The -- the fifth Hoa Cau VFX: four strokes light one by one into the
// fire glyph, then the completed character burns as living flame with rising embers.
// Stroke textures come from the four fire-stroke-*.svg sources beside this file
// (each keeps the shared 256 viewBox so all four align at x:0 y:0 size:256).
const duration = 2.4
const track = pairs => ({ keys: pairs.map(([t, v]) => ({ t, v })) })
const curve = (a, b, c) => ({ pts: [{ t: 0, v: a }, { t: 0.42, v: b }, { t: 1, v: c }] })
const grad = (...stops) => ({ stops: stops.map(([t, c]) => ({ t, c })) })

const sourceDir = dirname(fileURLToPath(import.meta.url))
const svgData = name =>
  `data:image/svg+xml;base64,${Buffer.from(readFileSync(join(sourceDir, name), 'utf8')).toString('base64')}`

// Stroke centerlines in comp space (comp center = SVG 128,128). Light order:
// left dot, right dot, left falling, right falling.
const STROKES = [
  { id: 'lr_hoa_the_stroke_1', texId: 'tex_hoa_the_stroke_1', file: 'fire-stroke-1.svg', litAt: 0.15 },
  { id: 'lr_hoa_the_stroke_2', texId: 'tex_hoa_the_stroke_2', file: 'fire-stroke-2.svg', litAt: 0.45 },
  { id: 'lr_hoa_the_stroke_3', texId: 'tex_hoa_the_stroke_3', file: 'fire-stroke-3.svg', litAt: 0.75 },
  { id: 'lr_hoa_the_stroke_4', texId: 'tex_hoa_the_stroke_4', file: 'fire-stroke-4.svg', litAt: 1.05 },
]
// Flame-lick emitters trace each stroke's centerline; particles born along the
// path drift upward so the strokes read as fire, not as pasted art.
const LICK_PATHS = [
  { id: 'lr_hoa_the_licks_1', seed: 920031, size: 30, nodes: [[-56, -4], [-48, -34], [-42, -56]] },
  { id: 'lr_hoa_the_licks_2', seed: 920032, size: 30, nodes: [[46, -56], [58, -34], [66, -12]] },
  { id: 'lr_hoa_the_licks_3', seed: 920033, size: 40, nodes: [[3, -68], [12, -18], [-8, 32], [-53, 67]] },
  { id: 'lr_hoa_the_licks_4', seed: 920034, size: 40, nodes: [[11, -8], [32, 32], [72, 70]] },
]

function strokeLayer(stroke) {
  const { id, texId, litAt } = stroke
  return {
    id, name: `Fire stroke ${id.slice(-1)} lights`, type: 'sprite',
    start: 0, end: duration, blend: 'add',
    opacity: track([[0, 0], [litAt, 0], [litAt + 0.22, 1], [duration, 1]]),
    sp: {
      sprite: { kind: 'tex', texId }, size: 256, x: 0, y: 0,
      scale: track([[0, 0.94], [litAt, 0.94], [litAt + 0.22, 1], [duration, 1]]),
      glow: track([[0, 0], [litAt, 0], [litAt + 0.1, 1.6], [litAt + 0.34, 0.5], [duration, 0.72]]),
    },
  }
}

function lickEmitter(path) {
  return {
    id: path.id, name: `Flame licks on ${path.id.slice(-1)}`, type: 'emitter',
    start: 1.15, end: duration, blend: 'add',
    opacity: track([[0, 0], [0.12, 0.9], [duration, 0.9]]),
    em: {
      x: 0, y: 0, shape: 'point', sx: 0, sy: 0, dir: 'dir', angle: -90, spread: 38,
      speed: 56, speedRnd: 0.5, rate: 130, bursts: [], seed: path.seed,
      path: { on: true, mode: 'emit', closed: false, smooth: true,
        nodes: path.nodes.map(([x, y]) => ({ x, y })),
        along: 'even', jitter: 3, aim: 'none', attract: 0, lock: 0, flow: 0, fast: true },
    },
    pt: {
      life: 0.62, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'flame', p: { taper: 1 } },
      size: path.size, sizeRnd: 0.42, sizeOL: curve(0.55, 1, 0.1), opacityOL: curve(0.05, 0.55, 0),
      grad: grad([0, [255, 246, 170]], [0.45, [255, 150, 45]], [1, [200, 34, 10]]),
      alignVel: true, stretch: 1.1, drag: 1.2, turbMode: 'curl', turbAmp: 46,
      turbScale: 24, turbOct: 2, turbWind: 20, turbRise: -38, glow: 0.45,
    },
  }
}

export function buildHoaThe() {
  const layers = [
    {
      id: 'lr_hoa_the_sparks', name: 'Cinders drifting off the seal', type: 'emitter',
      start: 0.9, end: duration, blend: 'add',
      em: {
        x: 4, y: 12, shape: 'box', sx: 110, sy: 110, dir: 'dir', angle: -90, spread: 56,
        speed: 68, speedRnd: 0.6, rate: 32, bursts: [{ t: 1.5, n: 18 }], seed: 920030,
      },
      pt: {
        life: 1.6, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'ember', p: {} },
        size: 7, sizeRnd: 0.45, sizeOL: curve(0.6, 1, 0.2), opacityOL: curve(0, 0.95, 0),
        grad: grad([0, [255, 246, 200]], [0.4, [255, 170, 60]], [1, [200, 40, 12]]),
        drag: 0.5, turbMode: 'curl', turbAmp: 60, turbScale: 30, turbOct: 2,
        turbWind: 26, turbRise: -50, glow: 1.0,
      },
    },
    {
      id: 'lr_hoa_the_displace', name: 'Living flame wobble on strokes', type: 'postfx',
      start: 1.05, end: duration, opacity: track([[0, 0], [0.3, 0.55], [duration, 0.55]]),
      blend: 'add', targets: STROKES.map(s => s.id),
      fx: { effect: 'displace', field: 'swirl', amount: 11, scale: 18, aspect: 2.4,
        oct: 2, evo: 0.11, rise: -36, ramp: 0, seed: 920040 },
    },
    ...LICK_PATHS.map(lickEmitter),
    ...STROKES.map(strokeLayer),
    {
      id: 'lr_hoa_the_bloom', name: 'Bloom behind the completed seal', type: 'sprite',
      start: 0, end: duration, blend: 'screen',
      opacity: track([[0, 0], [1.2, 0], [1.6, 0.3], [duration, 0.34]]),
      sp: { sprite: { kind: 'shape', id: 'soft', p: {} }, size: 210, x: 4, y: 12,
        color: [255, 120, 30], glow: 0.6,
        scale: track([[1.2, 0.85], [1.7, 1], [duration, 1.02]]) },
    },
    {
      id: 'lr_hoa_the_ember_back', name: 'Breathing ember core behind strokes', type: 'sprite',
      start: 0, end: duration, blend: 'add',
      opacity: track([[0, 0], [0.9, 0], [1.35, 0.14], [1.7, 0.3], [duration, 0.26]]),
      sp: { sprite: { kind: 'shape', id: 'soft', p: {} }, size: 150, x: 4, y: 14,
        color: [210, 60, 18], glow: 0.5,
        scale: track([[0, 0.8], [0.6, 0.9], [1.2, 0.8], [1.8, 0.9], [duration, 0.8]]) },
    },
  ]
  return {
    app: 'arcadia-effects', v: 1,
    doc: {
      v: 1, id: 'fx_hoa_the', name: 'Hoa The',
      comp: { w: 256, h: 256, dur: duration, fps: 60 }, cam: { comp: 0 },
      exp: { cols: 6, rows: 6, frames: 36, cellW: 256, cellH: 256,
        t0: 0, t1: duration, mode: 'rgba', ss: 2 },
      textures: STROKES.map(s => ({ id: s.texId, name: `fire stroke ${s.id.slice(-1)}`, sheet: null })),
      layers,
    },
    tex: Object.fromEntries(STROKES.map(s => [s.texId, svgData(s.file)])),
  }
}

const sourceFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === sourceFile) {
  const target = process.argv[2]
  if (!target) throw new Error('Pass the Arcadia library JSON path')
  const absoluteTarget = resolve(target)
  if (existsSync(absoluteTarget)) {
    const current = JSON.parse(readFileSync(absoluteTarget, 'utf8'))
    if (current.doc?.id !== 'fx_hoa_the') {
      throw new Error(`Refusing to overwrite another effect: ${current.doc?.id}`)
    }
  }
  writeFileSync(absoluteTarget, `${JSON.stringify(buildHoaThe(), null, 2)}\n`)
}
