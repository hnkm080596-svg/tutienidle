import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'
import { STOMP_SOLE_SVG } from './mob-parts.mjs'

const DOC_ID = 'fx_mob_stomp_multi'

const sole = texture('mob_stompmulti_sole', STOMP_SOLE_SVG)
const TEXTURES = [sole]

// Grounded anchor: comp y ~= +0.35*h under center with h=192.
const FEET = 58

// Two alternating stomps: left foot lands at t=0.11, right foot at t=0.34,
// each with its own dent, dust ring and shard spray so the pair reads as
// trampling, not a replayed single stomp.
const STEPS = [{ t: 0.11, x: -38 }, { t: 0.34, x: 38 }]

const soleLayer = ({ t, x, id }) => ({
  id, name: `Sole ${id.slice(-1)}`, type: 'sprite', blend: 'normal',
  start: -0.02, end: 0.6,
  opacity: track([[t - 0.09, 0], [t - 0.065, 1], [t + 0.22, 1], [t + 0.26, 0]]),
  sp: {
    sprite: { kind: 'tex', texId: sole.id, p: {} }, size: 200,
    x, y: track([[t - 0.09, -160], [t, FEET - 48], [t + 0.26, FEET - 48]]),
    // squash is static-only; the landing pinch is faked with a scale dip.
    scale: track([[t - 0.09, 0.9], [t, 1], [t + 0.025, 0.86], [t + 0.11, 1]]),
    aspect: 1, rot: x < 0 ? -6 : 6, color: [255, 255, 255],
    squash: 0.62,
    glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
  },
})

const dentLayer = ({ t, x, id }) => ({
  id, name: `Dent ${id.slice(-1)}`, type: 'sprite', blend: 'normal',
  start: -0.02, end: 0.6,
  opacity: track([[t - 0.005, 0], [t + 0.03, 0.55], [t + 0.2, 0.45], [t + 0.26, 0]]),
  sp: {
    sprite: { kind: 'shape', id: 'soft', p: {} }, size: 110, x, y: FEET + 8,
    scale: track([[t - 0.005, 0.5], [t + 0.05, 1.1], [t + 0.26, 1.3]]),
    aspect: 1, rot: 0, color: [40, 26, 16], squash: 0.55, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
  },
})

export function buildMobStompMulti() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Stomp Multi',
      comp: { w: 256, h: 192, dur: 0.6, fps: 30 },
      cam: { comp: 32 },
      exp: { cols: 5, rows: 4, frames: 18, cellW: 256, cellH: 192, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        soleLayer({ ...STEPS[0], id: 'lr_sm_sole_a' }),
        dentLayer({ ...STEPS[0], id: 'lr_sm_dent_a' }),
        {
          id: 'lr_sm_flash', name: 'Impact Flashes', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.6,
          opacity: track([[0.105, 0], [0.13, 0.85], [0.22, 0], [0.335, 0], [0.36, 0.9], [0.47, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 150,
            x: track([[0.105, -38], [0.335, 38]]), y: FEET - 12,
            scale: track([[0.105, 0.4], [0.16, 1.4], [0.335, 1.1], [0.4, 1.5]]),
            aspect: 1, rot: 0, color: [255, 232, 190], squash: 0.4, glow: 0.45, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_sm_ring', name: 'Dust Rings', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.6,
          opacity: track([[0.105, 0], [0.14, 0.7], [0.3, 0], [0.335, 0], [0.37, 0.7], [0.55, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'ring', p: { th: 0.16 } }, size: 170,
            x: track([[0.105, -38], [0.335, 38]]), y: FEET,
            scale: track([[0.105, 0.25], [0.3, 1.9], [0.335, 0.3], [0.55, 2.1]]),
            aspect: 1, rot: 0, color: [238, 196, 130], squash: 0.5, glow: 0.3, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        soleLayer({ ...STEPS[1], id: 'lr_sm_sole_b' }),
        dentLayer({ ...STEPS[1], id: 'lr_sm_dent_b' }),
        {
          id: 'lr_sm_dust', name: 'Dust Clouds', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.6,
          em: {
            x: track([[0.11, -38], [0.34, 38]]), y: FEET - 2,
            shape: 'ring', sx: 14, sy: 5, dir: 'out', angle: -90, spread: 30,
            speed: 160, speedRnd: 0.35, rate: 0,
            bursts: [{ t: 0.11, n: 10 }, { t: 0.16, n: 5 }, { t: 0.34, n: 11 }, { t: 0.39, n: 6 }], seed: 47,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.45, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'smoke', p: {} }, size: 24, sizeRnd: 0.4,
            sizeOL: curve([0, 0.5], [0.45, 1], [1, 1.35]),
            opacityOL: curve([0, 0], [0.2, 0.8], [1, 0]),
            grad: grad([0, [226, 194, 144]], [0.55, [176, 138, 92]], [1, [122, 92, 60]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 30, spinRnd: 0.5, alignVel: false, stretch: 0,
            gravX: 0, gravY: -16, drag: 2.2, turbAmp: 14, turbFreq: 1.2, squash: 0.4, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_sm_rocks', name: 'Thrown Rocks', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.6,
          em: {
            x: track([[0.11, -38], [0.34, 38]]), y: FEET - 4,
            shape: 'point', sx: 10, sy: 5, dir: 'dir', angle: -90, spread: 75,
            speed: 215, speedRnd: 0.45, rate: 0,
            bursts: [{ t: 0.11, n: 8 }, { t: 0.34, n: 9 }], seed: 53,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.5, lifeRnd: 0.3, sprite: { kind: 'shape', id: 'shard', p: {} }, size: 10, sizeRnd: 0.45,
            sizeOL: curve([0, 1], [0.8, 0.9], [1, 0.3]),
            opacityOL: curve([0, 1], [0.75, 1], [1, 0]),
            grad: grad([0, [158, 114, 68]], [0.6, [112, 78, 46]], [1, [72, 48, 30]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 180, spinRnd: 0.8, alignVel: false, stretch: 0,
            gravX: 0, gravY: 400, drag: 0.4, turbAmp: 10, turbFreq: 1.5, squash: 0, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_sm_shadow', name: 'Sole Shadows', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.6,
          opacity: track([[0.02, 0], [0.09, 0.35], [0.11, 0.55], [0.22, 0.2], [0.28, 0], [0.31, 0.35], [0.34, 0.55], [0.5, 0.3], [0.6, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 140,
            x: track([[0.02, -38], [0.25, 38]]), y: FEET + 6,
            scale: track([[0.02, 1.3], [0.11, 0.9], [0.25, 1.3], [0.34, 0.9]]),
            aspect: 1, rot: 0, color: [22, 14, 9], squash: 0.5, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobStompMulti, DOC_ID, import.meta.url)
