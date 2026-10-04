import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Hoa Tu Charge (2026-10-04 rebuild) -- spirit-bomb charge for Ly Hoa Thuat.
// The old 0.55s clip was stretched across the 1700ms charge window and read
// as slow motion next to the circle; this doc is authored for the FULL
// window so the render plays it at authored rate. Look: converging energy
// (Genki-dama style) - thin streaks and embers fly INWARD into a swelling
// fire orb at the raised palm, no outward radiation until the final
// release-flash handoff to the phoenix projectile.
const duration = 1.7
const track = pairs => ({ keys: pairs.map(([t, v]) => ({ t, v })) })
const grad = (...stops) => ({ stops: stops.map(([t, c]) => ({ t, c })) })
const curve = (a, b, c) => ({ pts: [{ t: 0, v: a }, { t: 0.42, v: b }, { t: 1, v: c }] })
const shape = id => ({ kind: 'shape', id, p: {} })

function sprite(id, name, start, end, sp, opacity) {
  return { id, name, type: 'sprite', start, end, blend: 'add', opacity, sp }
}

// Converging emitter: particles spawn on a ring and get sucked to the orb.
// start<0 pre-warms the seeded sim so frame 0 already reads mid-gather.
function inflow(id, name, seed, rate, radius, speed, particle, emExtra = {}) {
  return {
    id, name, type: 'emitter', start: -0.3, end: duration - 0.12, blend: 'add',
    em: { shape: 'ring', sx: radius, sy: radius, dir: 'in', speed,
      speedRnd: 0.25, rate, bursts: [], seed, ...emExtra },
    pt: particle,
  }
}

export function buildHoaTuCharge() {
  const layers = [
    // Faint breathing halo under everything - the orb's heat bloom.
    sprite('lr_ht_halo', 'Breathing heat halo', 0.15, duration,
      { sprite: shape('soft'), x: 0, y: 0, size: 96, aspect: 1,
        color: [230, 84, 24], glow: 0.12,
        scale: track([[0.15, 0.5], [0.5, 0.78], [0.85, 0.92], [1.15, 0.86], [1.4, 0.97], [duration, 1.05]]) },
      track([[0.15, 0], [0.45, 0.16], [1.0, 0.22], [1.4, 0.3], [duration, 0.38]])),

    // The fire orb itself: swells through the window with small pulses,
    // amber -> white-hot as it feeds.
    sprite('lr_ht_orb', 'Swelling fire orb', 0.1, duration,
      { sprite: shape('soft'), x: 0, y: 0, size: 52, aspect: 1,
        color: track([[0.1, [214, 57, 17]], [0.5, [243, 94, 20]], [0.95, [255, 144, 30]], [1.35, [255, 190, 60]], [duration, [255, 224, 120]]]),
        glow: 0.55,
        scale: track([[0.1, 0.34], [0.4, 0.55], [0.75, 0.62], [1.0, 0.74], [1.3, 0.8], [1.55, 0.9], [duration, 1]]) },
      track([[0.1, 0], [0.28, 0.85], [1.4, 0.95], [duration, 1]])),

    // White-hot heart wakes late - the orb is ready to release.
    sprite('lr_ht_heart', 'White hot orb heart', 1.0, duration,
      { sprite: shape('soft'), x: 0, y: 0, size: 26, aspect: 1,
        color: [255, 250, 224], glow: 0.9,
        scale: track([[1.0, 0.3], [1.25, 0.75], [1.45, 0.6], [1.6, 0.85], [duration, 1]]) },
      track([[1.0, 0], [1.2, 0.7], [1.5, 0.85], [duration, 1]])),

    // Signature Genki-dama streams: long thin streaks spiral into the orb
    // from every direction - two counter-rates keep the inflow alive.
    inflow('lr_ht_streaks_a', 'Inward energy streaks', 573110, 26, 96, 175, {
      life: 0.62, lifeRnd: 0.25, sprite: shape('streak'), size: 5.5, sizeRnd: 0.35,
      opacityOL: curve(0.1, 0.95, 0.75), alignVel: true, stretch: 2.4,
      grad: grad([0, [255, 236, 170]], [0.55, [255, 150, 45]], [1, [255, 90, 20]]),
      drag: 0.35, turbMode: 'curl', turbAmp: 26, turbScale: 30, turbOct: 2, turbWind: 30, glow: 0.5,
    }, { sy: 96 }),
    inflow('lr_ht_streaks_b', 'Wide orbit streaks', 573120, 14, 118, 140, {
      life: 0.85, lifeRnd: 0.25, sprite: shape('streak'), size: 4.5, sizeRnd: 0.4,
      opacityOL: curve(0.08, 0.8, 0.7), alignVel: true, stretch: 3,
      grad: grad([0, [255, 218, 150]], [0.5, [255, 130, 38]], [1, [255, 74, 16]]),
      drag: 0.3, turbMode: 'curl', turbAmp: 40, turbScale: 46, turbOct: 2, turbWind: 52, glow: 0.42,
    }, { sy: 118 }),

    // Dense ember feed - the fine-grained inflow underneath the streaks.
    inflow('lr_ht_embers', 'Swallowed ember feed', 573130, 55, 82, 165, {
      life: 0.55, lifeRnd: 0.3, sprite: shape('ember'), size: 4, sizeRnd: 0.45,
      opacityOL: curve(0.15, 0.9, 0.6), sizeOL: curve(0.9, 1, 0.5),
      grad: grad([0, [255, 238, 180]], [0.55, [250, 130, 38]], [1, [232, 62, 16]]),
      drag: 0.5, turbAmp: 24, turbFreq: 3.4, glow: 0.35,
    }, { sy: 82 }),

    // Swallow sparks: each arriving stream pops as a tiny bright blip at the
    // orb surface (small continuous pops, not one flash).
    {
      id: 'lr_ht_swallow', name: 'Absorption blips at orb edge', type: 'emitter',
      start: 0.25, end: duration - 0.1, blend: 'add',
      em: { shape: 'ring', sx: 26, sy: 26, dir: 'omni', speed: 12,
        speedRnd: 0.4, rate: 22, bursts: [], seed: 573140 },
      pt: {
        life: 0.2, lifeRnd: 0.25, sprite: shape('soft'), size: 6, sizeRnd: 0.5,
        opacityOL: curve(0.9, 0.5, 0), sizeOL: curve(0.6, 1.3, 0.4),
        grad: grad([0, [255, 248, 214]], [1, [255, 150, 40]]), glow: 0.55,
      },
    },

    // Faint heat shimmer rising under the palm - the ground feeds the orb.
    {
      id: 'lr_ht_rise', name: 'Rising heat motes', type: 'emitter',
      start: 0.3, end: duration - 0.15, blend: 'add',
      em: { shape: 'box', sx: 40, sy: 6, y: 42, dir: 'dir', angle: -90, spread: 24,
        speed: 46, speedRnd: 0.4, rate: 18, bursts: [], seed: 573150 },
      pt: {
        life: 0.8, lifeRnd: 0.35, sprite: shape('ember'), size: 3.5, sizeRnd: 0.5,
        opacityOL: curve(0.05, 0.4, 0), sizeOL: curve(1, 0.7, 0.3),
        grad: grad([0, [255, 190, 90]], [1, [255, 96, 26]]),
        drag: 0.3, turbAmp: 14, turbFreq: 2.4, glow: 0.2,
      },
    },

    // Occasional curved wisps arcing into the orb (staggered repeats of the
    // authored single-shot paths - same trick as the old clip, sustained).
    ...[0, 0.55, 1.1].flatMap((offset, i) => [
      sprite(`lr_ht_wisp_${i * 2}`, 'Curved wisp arc', offset + 0.05, offset + 0.5,
        { sprite: shape('ember'), size: 12,
          x: track([[0, -66], [0.15, -38], [0.31, -14], [0.45, 0]]),
          y: track([[0, -20], [0.15, -38], [0.31, -16], [0.45, 0]]),
          scale: track([[0, 0.6], [0.37, 1], [0.45, 0.1]]),
          color: [255, 128, 36], glow: 0.4 },
        track([[0, 0], [0.1, 1], [0.45, 0.9]])),
      sprite(`lr_ht_wisp_${i * 2 + 1}`, 'Curved wisp arc mirrored', offset + 0.1, offset + 0.55,
        { sprite: shape('ember'), size: 11,
          x: track([[0, 64], [0.16, 34], [0.3, 12], [0.45, 0]]),
          y: track([[0, 14], [0.16, 28], [0.3, 14], [0.45, 0]]),
          scale: track([[0, 0.6], [0.36, 1], [0.45, 0.1]]),
          color: [255, 116, 30], glow: 0.4 },
        track([[0, 0], [0.1, 1], [0.45, 0.9]])),
    ]),

    // Release handoff: a tight intake pulse + bright flash as the cast
    // commits - the phoenix picks up the brightness from here.
    sprite('lr_ht_intake', 'Final intake pulse', 1.52, duration,
      { sprite: shape('ring'), x: 0, y: 0, size: 70, aspect: 1,
        color: [255, 210, 120], glow: 0.7,
        scale: track([[1.52, 1.5], [1.66, 0.5], [duration, 0.2]]) },
      track([[1.52, 0.9], [1.66, 0.5], [duration, 0]])),
    sprite('lr_ht_flash', 'Release flash', 1.62, duration,
      { sprite: shape('soft'), x: 0, y: 0, size: 44, aspect: 1,
        color: [255, 246, 214], glow: 1.15,
        scale: track([[1.62, 0.4], [1.68, 1.3], [duration, 1.8]]) },
      track([[1.62, 0], [1.66, 1], [duration, 0.9]])),
  ]
  return {
    app: 'arcadia-effects', v: 1,
    doc: { v: 1, id: 'fx_hoa_tu_charge', name: 'Hoa Tu Charge',
      comp: { w: 192, h: 192, dur: duration, fps: 60 }, cam: { comp: 0 },
      exp: { cols: 8, rows: 7, frames: 51, cellW: 192, cellH: 192,
        t0: 0, t1: duration, mode: 'rgba', thr: 0, ss: 2 },
      textures: [], layers },
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
    if (current.doc?.id !== 'fx_hoa_tu_charge') {
      throw new Error(`Refusing to overwrite another effect: ${current.doc?.id}`)
    }
  }
  writeFileSync(absoluteTarget, `${JSON.stringify(buildHoaTuCharge(), null, 2)}\n`)
}
