import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_stomp_multi'

// Spectral boar foreleg + cloven hoof. The left foot uses the art as drawn
// (fetlock/back on the right); the right foot is the same art mirrored so the
// pair reads as opposite hooves, not a replayed sprite.
const HOOF_INNER = `
  <path fill="#e8d6b4" fill-opacity="0.62" stroke="#7d5b38" stroke-opacity="0.85" stroke-width="5.5" stroke-linejoin="round"
    d="M48 -8 C44 62 42 118 42 156 C42 172 40 186 36 200 L26 226
       C21 240 16 250 16 258 C16 265 21 270 27 270 C34 270 39 266 42 260
       L50 240 C52 235 57 235 59 240 L68 260
       C70 267 77 271 84 271 C91 271 98 267 102 260
       C108 252 110 245 109 238 C108 232 102 228 96 226
       C99 220 98 214 94 208 L88 202
       L102 198 L92 192 L106 188 L94 182 L108 178 L96 172
       C104 152 110 128 114 102 C120 62 124 24 126 -8 Z"/>
  <path d="M16 252 C16 262 21 270 27 270 C34 270 39 266 42 260 L38 248 Z"
        fill="#8a6742" fill-opacity="0.55"/>
  <path d="M62 248 L68 260 C70 267 77 271 84 271 C91 271 95 268 98 262 L90 246 Z"
        fill="#8a6742" fill-opacity="0.45"/>
  <path d="M38 198 C52 206 74 208 90 202" stroke="#8a6742" stroke-opacity="0.4" stroke-width="4" fill="none" stroke-linecap="round"/>
  <ellipse cx="66" cy="220" rx="56" ry="46" fill="url(#hot)"/>
  <path d="M42 96 C36 120 34 142 38 160" stroke="#f2e2bc" stroke-opacity="0.35" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M116 36 C124 60 124 84 120 106" stroke="#f2e2bc" stroke-opacity="0.28" stroke-width="5" fill="none" stroke-linecap="round"/>`

const wrapSvg = (inner, transform) => `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="340" viewBox="0 0 256 340">
  <defs>
    <radialGradient id="hot" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff6da" stop-opacity="0.6"/>
      <stop offset="0.65" stop-color="#ffedc0" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffedc0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g transform="${transform}">${inner}</g>
</svg>`

const legL = texture('mob_stompmulti_leg_l', wrapSvg(HOOF_INNER, 'translate(56,0)'))
const legR = texture('mob_stompmulti_leg_r', wrapSvg(HOOF_INNER, 'translate(200,0) scale(-1,1)'))
const TEXTURES = [legL, legR]

// Grounded anchor: comp y ~= +0.35*h under center with h=192.
const FEET = 58
// Sprite center that puts the hoof sole on the ground line (see SVG layout).
const LAND_Y = -21

// Two alternating stomps: left foot lands at t=0.11, right foot at t=0.34,
// each with its own flash/dent/ring/dust/shard/spark beat.
const STEPS = [
  { t: 0.11, x: -38, rot: -4, tex: legL, leg: 'lr_sm_leg_a', dent: 'lr_sm_dent_a', shadow: 'lr_sm_shadow_a', wisps: 'lr_sm_wisps_a' },
  { t: 0.34, x: 38, rot: 4, tex: legR, leg: 'lr_sm_leg_b', dent: 'lr_sm_dent_b', shadow: 'lr_sm_shadow_b', wisps: 'lr_sm_wisps_b' },
]

const legLayer = ({ t, x, rot, tex, id }) => ({
  id, name: `Spectral Leg ${id.slice(-1)}`, type: 'sprite', blend: 'normal',
  start: -0.02, end: 0.62,
  opacity: track([[t - 0.09, 0], [t - 0.06, 0.82], [t + 0.11, 0.82], [t + 0.23, 0]]),
  sp: {
    sprite: { kind: 'tex', texId: tex.id, p: {} }, size: 260,
    x: track([[t - 0.09, x + 26], [t, x]]),
    y: {
      keys: [
        { t: t - 0.09, v: -260, i: { m: 'ease' }, o: { m: 'cust', h: [0.4, 0] } },
        { t, v: LAND_Y, i: { m: 'lin' } },
        { t: t + 0.19, v: LAND_Y - 4 },
        { t: t + 0.28, v: LAND_Y - 4 },
      ],
    },
    scale: track([[t - 0.09, 0.92], [t, 1], [t + 0.022, 0.88], [t + 0.11, 1]]),
    aspect: 1, rot: track([[t - 0.09, rot * 1.35], [t, rot]]), color: [255, 255, 255],
    squash: 0.4,
    glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
  },
})

const dentLayer = ({ t, x, id }) => ({
  id, name: `Dent ${id.slice(-1)}`, type: 'sprite', blend: 'normal',
  start: -0.02, end: 0.62,
  opacity: track([[t - 0.005, 0], [t + 0.03, 0.34], [t + 0.2, 0.26], [t + 0.26, 0]]),
  sp: {
    sprite: { kind: 'shape', id: 'soft', p: {} }, size: 108, x, y: FEET + 8,
    scale: track([[t - 0.005, 0.5], [t + 0.05, 1.1], [t + 0.26, 1.3]]),
    aspect: 1, rot: 0, color: [62, 44, 28], squash: 1, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
  },
})

const shadowLayer = ({ t, x, id }) => ({
  id, name: `Shadow ${id.slice(-1)}`, type: 'sprite', blend: 'normal',
  start: -0.02, end: 0.62,
  opacity: track([[t - 0.09, 0], [t - 0.01, 0.22], [t, 0.32], [t + 0.17, 0.2], [t + 0.26, 0]]),
  sp: {
    sprite: { kind: 'shape', id: 'soft', p: {} }, size: 130, x, y: FEET + 6,
    scale: track([[t - 0.09, 1.3], [t, 0.85]]),
    aspect: 1, rot: 0, color: [40, 28, 18], squash: 1, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
  },
})

const wispLayer = ({ t, x, id }) => ({
  id, name: `Wisps ${id.slice(-1)}`, type: 'emitter', blend: 'add',
  start: -0.02, end: 0.62,
  em: {
    x: track([[t - 0.09, x + 26], [t, x]]),
    y: track([[t - 0.06, -150], [t, 30]]),
    shape: 'ring', sx: 26, sy: 60, dir: 'omni', angle: -90, spread: 360,
    speed: 26, speedRnd: 0.5, rate: 0,
    bursts: [{ t: t - 0.05, n: 5 }, { t: t - 0.03, n: 5 }, { t: t + 0.03, n: 6 }, { t: t + 0.09, n: 5 }], seed: 29 + Math.round(x),
    branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
  },
  pt: {
    life: 0.5, lifeRnd: 0.5, sprite: { kind: 'shape', id: 'spark', p: {} }, size: 8, sizeRnd: 0.5,
    sizeOL: curve([0, 0.6], [0.4, 1], [1, 0.7]),
    opacityOL: curve([0, 0], [0.25, 0.75], [1, 0]),
    grad: grad([0, [255, 246, 220]], [0.6, [240, 206, 140]], [1, [200, 160, 96]]),
    tintTex: false, rot: 0, rotRnd: 1, spin: 45, spinRnd: 0.5, alignVel: false, stretch: 0,
    gravX: 0, gravY: -70, drag: 1.8, turbAmp: 16, turbFreq: 1.1, squash: 0, glow: 0.3,
    glowSize: 1.8, glowBlur: 0.2, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
  },
})

export function buildMobStompMulti() {
  const [a, b] = STEPS
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
        {
          id: 'lr_sm_sparks', name: 'Impact Sparks', type: 'emitter', blend: 'add',
          start: -0.02, end: 0.62,
          em: {
            x: track([[0.11, -38], [0.34, 38]]), y: FEET - 6,
            shape: 'point', sx: 8, sy: 4, dir: 'dir', angle: -90, spread: 115,
            speed: 175, speedRnd: 0.45, rate: 0,
            bursts: [{ t: 0.11, n: 8 }, { t: 0.165, n: 4 }, { t: 0.34, n: 9 }, { t: 0.395, n: 5 }], seed: 71,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.4, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'ember', p: {} }, size: 9, sizeRnd: 0.4,
            sizeOL: curve([0, 1.1], [0.7, 0.8], [1, 0.2]),
            opacityOL: curve([0, 0], [0.12, 0.9], [1, 0]),
            grad: grad([0, [255, 244, 214]], [0.5, [246, 200, 120]], [1, [200, 138, 70]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 60, spinRnd: 0.6, alignVel: false, stretch: 0,
            gravX: 0, gravY: 320, drag: 1.2, turbAmp: 12, turbFreq: 1.4, squash: 0, glow: 0.35,
            glowSize: 1.8, glowBlur: 0.2, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_sm_flash', name: 'Impact Flashes', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.62,
          opacity: track([[0.105, 0], [0.125, 0.7], [0.2, 0], [0.335, 0], [0.355, 0.72], [0.45, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 64,
            x: track([[0.105, -38], [0.335, 38]]), y: FEET - 14,
            scale: track([[0.105, 0.5], [0.17, 1.15], [0.335, 0.9], [0.42, 1.2]]),
            aspect: 1, rot: 0, color: [255, 240, 200], squash: 0.55, glow: 0.4, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        legLayer({ ...a, id: a.leg }),
        legLayer({ ...b, id: b.leg }),
        {
          id: 'lr_sm_ring', name: 'Dust Rings', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.62,
          opacity: track([[0.105, 0], [0.14, 0.5], [0.3, 0], [0.335, 0], [0.37, 0.52], [0.55, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'ring', p: { th: 0.14 } }, size: 170,
            x: track([[0.105, -38], [0.335, 38]]), y: FEET,
            scale: track([[0.105, 0.25], [0.3, 1.9], [0.335, 0.3], [0.55, 2.1]]),
            aspect: 1, rot: 0, color: [240, 210, 158], squash: 1, glow: 0.25, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_sm_rocks', name: 'Thrown Rocks', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.62,
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
            opacityOL: curve([0, 0.9], [0.75, 0.9], [1, 0]),
            grad: grad([0, [228, 190, 132]], [0.6, [172, 132, 86]], [1, [112, 82, 52]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 180, spinRnd: 0.8, alignVel: false, stretch: 0,
            gravX: 0, gravY: 400, drag: 0.4, turbAmp: 10, turbFreq: 1.5, squash: 0, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_sm_dust', name: 'Dust Clouds', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.62,
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
            opacityOL: curve([0, 0], [0.2, 0.65], [1, 0]),
            grad: grad([0, [232, 200, 150]], [0.55, [184, 146, 98]], [1, [130, 98, 64]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 30, spinRnd: 0.5, alignVel: false, stretch: 0,
            gravX: 0, gravY: -16, drag: 2.2, turbAmp: 14, turbFreq: 1.2, squash: 0.4, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        wispLayer({ ...a, id: a.wisps }),
        wispLayer({ ...b, id: b.wisps }),
        dentLayer({ ...a, id: a.dent }),
        dentLayer({ ...b, id: b.dent }),
        shadowLayer({ ...a, id: a.shadow }),
        shadowLayer({ ...b, id: b.shadow }),
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobStompMulti, DOC_ID, import.meta.url)
