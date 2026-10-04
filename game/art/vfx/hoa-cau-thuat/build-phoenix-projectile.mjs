import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const duration = 1.2
const curve = (a, b, c) => ({ pts: [{ t: 0, v: a }, { t: 0.42, v: b }, { t: 1, v: c }] })
const track = pairs => ({ keys: pairs.map(([t, v]) => ({ t, v })) })
const grad = (...stops) => ({ stops: stops.map(([t, c]) => ({ t, c })) })
const shape = id => ({ kind: 'shape', id, p: {} })

function emitter(id, name, seed, x, y, rate, speed, particle, emExtra = {}) {
  return {
    id, name, type: 'emitter', start: -0.35, end: duration, blend: 'screen',
    em: { x, y, shape: 'box', sx: 8, sy: 28, dir: 'dir', angle: 180, spread: 17,
      speed, speedRnd: 0.32, rate, bursts: [], seed, ...emExtra },
    pt: particle,
  }
}

export function buildPhoenixProjectile() {
  const layers = [
    emitter('lr_hc_phoenix_sparks', 'White gold cinders', 718351, 5, 0, 36, 300, {
      life: 0.34, lifeRnd: 0.36, sprite: shape('ember'), size: 7, sizeRnd: 0.42,
      opacityOL: curve(0.06, 0.94, 0), sizeOL: curve(0.5, 1, 0.15),
      grad: grad([0, [255, 252, 209]], [0.4, [255, 185, 57]], [1, [224, 45, 13]]),
      alignVel: true, stretch: 1.25, drag: 0.7, glow: 0.48,
    }, { sx: 15, sy: 20, spread: 17 }),
    {
      id: 'lr_hc_phoenix_white_core', name: 'White hot compressed heart', type: 'sprite',
      start: 0, end: duration, blend: 'add',
      opacity: track([[0, 0.8], [0.2, 0.98], [0.42, 0.87], [0.63, 1], [0.85, 0.86], [1.05, 1], [duration, 0.8]]),
      sp: { sprite: shape('soft'), x: 53, y: 0, size: 45, aspect: 1,
        color: [255, 253, 225], glow: 0.25,
        scale: track([[0, 0.98], [0.28, 1.08], [0.52, 0.94], [0.82, 1.05], [duration, 0.98]]) },
    },
    {
      id: 'lr_hc_phoenix_gold_core', name: 'Molten sun core', type: 'sprite',
      start: 0, end: duration, blend: 'screen', opacity: 0.94,
      sp: { sprite: shape('soft'), x: 43, y: 0, size: 78, aspect: 1.08,
        color: [255, 182, 40], glow: 0.26,
        scale: track([[0, 1], [0.24, 1.06], [0.52, 0.97], [0.82, 1.04], [duration, 1]]) },
    },
    emitter('lr_hc_phoenix_tongues', 'Amber fire tongues peeling backward', 718352, 20, 0, 98, 210, {
      life: 0.31, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'flame', p: { taper: 1 } },
      size: 42, sizeRnd: 0.37, sizeOL: curve(0.65, 1, 0.12), opacityOL: curve(0.03, 0.26, 0),
      grad: grad([0, [255, 226, 91]], [0.48, [255, 111, 27]], [1, [202, 26, 11]]),
      alignVel: true, stretch: 0.96, drag: 1.5, turbMode: 'curl', turbAmp: 27,
      turbScale: 24, turbOct: 2, turbWind: 21, turbRise: -17, glow: 0.14,
    }, { sx: 15, sy: 22, spread: 20 }),
    {
      id: 'lr_hc_phoenix_displace', name: 'Living flame edge distortion', type: 'postfx',
      start: 0, end: duration, opacity: 0.62, blend: 'screen',
      targets: ['lr_hc_phoenix_upper_ribbon', 'lr_hc_phoenix_lower_ribbon', 'lr_hc_phoenix_shell'],
      fx: { effect: 'displace', field: 'swirl', amount: 9, scale: 18,
        aspect: 2.2, oct: 2, evo: 0.14, rise: -32, seed: 718357 },
    },
    emitter('lr_hc_phoenix_upper_ribbon', 'Upper molten ribbon trail', 718353, -1, -3, 46, 330, {
      life: 0.48, lifeRnd: 0.22, render: 'trail', sprite: shape('streak'), size: 7,
      sizeRnd: 0.24, sizeOL: curve(0.62, 1, 0.18),
      sizeOT: { pts: [{ t: 0, v: 0.05 }, { t: 0.4, v: 0.5 }, { t: 1, v: 1.1 }] },
      opacityOL: curve(0.02, 0.19, 0),
      grad: grad([0, [255, 242, 151]], [0.45, [255, 139, 39]], [1, [174, 31, 15]]),
      drag: 0.5, turbMode: 'curl', turbAmp: 21, turbScale: 22, turbOct: 2,
      turbWind: 10, glow: 0.17,
    }, { sx: 4, sy: 5, spread: 8 }),
    emitter('lr_hc_phoenix_lower_ribbon', 'Lower vermilion ribbon trail', 718354, -2, 3, 46, 315, {
      life: 0.48, lifeRnd: 0.25, render: 'trail', sprite: shape('streak'), size: 7,
      sizeRnd: 0.28, sizeOL: curve(0.7, 1, 0.1),
      sizeOT: { pts: [{ t: 0, v: 0.05 }, { t: 0.4, v: 0.46 }, { t: 1, v: 1 }] },
      opacityOL: curve(0.02, 0.18, 0),
      grad: grad([0, [255, 193, 75]], [0.55, [255, 94, 29]], [1, [142, 20, 12]]),
      drag: 0.48, turbMode: 'curl', turbAmp: 20, turbScale: 21, turbOct: 2,
      turbWind: 11, glow: 0.16,
    }, { sx: 4, sy: 5, spread: 8 }),
    {
      id: 'lr_hc_phoenix_shell', name: 'Crimson fire shell', type: 'sprite',
      start: 0, end: duration, blend: 'screen', opacity: 0.72,
      sp: { sprite: shape('soft'), x: 28, y: 0, size: 96, aspect: 1.04,
        color: [240, 48, 17], glow: 0.12,
        scale: track([[0, 0.99], [0.3, 1.05], [0.65, 0.97], [0.92, 1.04], [duration, 0.99]]) },
    },
    {
      id: 'lr_hc_phoenix_halo', name: 'Subtle warm heat halo', type: 'sprite',
      start: 0, end: duration, blend: 'screen', opacity: 0.24,
      sp: { sprite: shape('soft'), x: 28, y: 0, size: 110, aspect: 1.04,
        color: [202, 43, 20], glow: 0.1 },
    },
  ]
  // Hand each seeded stream to an identical instance one loop later. The old
  // stream fades out as the new one reaches the same local simulation time it
  // had at t=0, so the editable Arcadia preview has a real loop handoff too.
  for (const id of [
    'lr_hc_phoenix_sparks',
    'lr_hc_phoenix_tongues',
    'lr_hc_phoenix_upper_ribbon',
    'lr_hc_phoenix_lower_ribbon',
  ]) {
    const index = layers.findIndex(layer => layer.id === id)
    const first = layers[index]
    first.opacity = track([[0, 1], [1.1, 1], [1.55, 0]])
    const repeat = structuredClone(first)
    repeat.id = `${id}_loop`
    repeat.name = `${first.name} loop handoff`
    repeat.start = first.start + duration
    repeat.opacity = track([[0, 0], [0.35, 1]])
    layers.splice(index + 1, 0, repeat)
  }
  layers.find(layer => layer.id === 'lr_hc_phoenix_displace').targets.push(
    'lr_hc_phoenix_upper_ribbon_loop',
    'lr_hc_phoenix_lower_ribbon_loop',
  )
  return {
    app: 'arcadia-effects', v: 1,
    doc: { v: 1, id: 'fx_hoa_cau_phoenix_projectile', name: 'Hoa Cau Phoenix Projectile',
      comp: { w: 320, h: 192, dur: duration, fps: 60 }, cam: { comp: 0 },
      exp: { cols: 6, rows: 6, frames: 36, cellW: 256, cellH: 154,
        t0: 0, t1: duration, mode: 'rgba', ss: 2 }, textures: [], layers },
    tex: {},
  }
}

const sourceFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === sourceFile) {
  const target = process.argv[2]
  if (!target) throw new Error('Pass a new Arcadia library JSON path')
  const absoluteTarget = resolve(target)
  if (existsSync(absoluteTarget)) {
    const current = JSON.parse(readFileSync(absoluteTarget, 'utf8'))
    if (current.doc?.id !== 'fx_hoa_cau_phoenix_projectile') {
      throw new Error(`Refusing to overwrite another effect: ${current.doc?.id}`)
    }
  }
  writeFileSync(absoluteTarget, `${JSON.stringify(buildPhoenixProjectile(), null, 2)}\n`)
}
