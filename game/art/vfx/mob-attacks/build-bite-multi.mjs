import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'
import { JAW_LOWER_SVG, JAW_UPPER_SVG } from './mob-parts.mjs'

const DOC_ID = 'fx_mob_bite_multi'

const upper = texture('mob_bitemulti_upper', JAW_UPPER_SVG)
const lower = texture('mob_bitemulti_lower', JAW_LOWER_SVG)
const TEXTURES = [upper, lower]

// Three frantic snaps at t=0.09/0.26/0.43. The jaw pair is a touch smaller
// than the single bite and jitters a few px sideways between snaps so the
// flurry reads as repeated chomping rather than a loop of one bite.
const SNAPS = [
  { t: 0.09, x: -7, s: 0.92 },
  { t: 0.26, x: 8, s: 0.98 },
  { t: 0.43, x: -3, s: 0.9 },
]

const OPEN = 44
const jawKeys = SNAPS.flatMap(({ t }) => [
  [t - 0.07, OPEN], [t, 3], [t + 0.03, 8], [t + 0.1, OPEN],
]).sort((a, b) => a[0] - b[0])
const upperKeys = jawKeys.map(([t, v]) => [t, -v])
const lowerKeys = jawKeys.map(([t, v]) => [t, v])
const xKeys = [[0, SNAPS[0].x], ...SNAPS.map(({ t, x }) => [t - 0.07, x]), [0.55, SNAPS[2].x]]

export function buildMobBiteMulti() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Bite Multi',
      comp: { w: 256, h: 192, dur: 0.55, fps: 30 },
      cam: { comp: 55 },
      exp: { cols: 5, rows: 4, frames: 17, cellW: 256, cellH: 192, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        {
          id: 'lr_bm_flash', name: 'Snap Flashes', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.55,
          opacity: track([[0.085, 0], [0.105, 0.85], [0.16, 0], [0.255, 0], [0.275, 0.8], [0.33, 0], [0.425, 0], [0.445, 0.9], [0.52, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 150,
            x: track([[0.085, -7], [0.255, -7], [0.27, 8], [0.425, 8], [0.44, -3]]), y: -4,
            scale: track([[0.09, 0.5], [0.12, 1.2], [0.26, 0.9], [0.28, 1.25], [0.43, 0.9], [0.46, 1.3]]),
            aspect: 1, rot: 0, color: [255, 238, 228], squash: 0, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_bm_flash_red', name: 'Red Bite Bloom', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.55,
          opacity: track([[0.09, 0], [0.12, 0.6], [0.19, 0], [0.26, 0], [0.29, 0.6], [0.36, 0], [0.43, 0], [0.46, 0.7], [0.53, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 190,
            x: track([[0.09, -7], [0.26, 8], [0.43, -3]]), y: -4,
            scale: track([[0.09, 0.7], [0.16, 1.5], [0.26, 1.0], [0.31, 1.6], [0.43, 1.0], [0.48, 1.6]]),
            aspect: 1, rot: 0, color: [255, 84, 68], squash: 0, glow: 0.35, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_bm_spray', name: 'Fang Sparks', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.55,
          em: {
            x: track([[0.09, -7], [0.26, 8], [0.43, -3]]), y: -4,
            shape: 'ring', sx: 8, sy: 8, dir: 'omni', angle: -90, spread: 40,
            speed: 250, speedRnd: 0.5, rate: 0,
            bursts: [{ t: 0.09, n: 7 }, { t: 0.26, n: 7 }, { t: 0.43, n: 10 }], seed: 19,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.28, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'streak', p: {} }, size: 8, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.6, 0.7], [1, 0.1]),
            opacityOL: curve([0, 1], [0.55, 0.9], [1, 0]),
            grad: grad([0, [255, 255, 255]], [0.5, [255, 190, 170]], [1, [200, 60, 50]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: true, stretch: 1.8,
            gravX: 0, gravY: 80, drag: 3, turbAmp: 8, turbFreq: 1.5, squash: 0, glow: 0.4,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_bm_droplets', name: 'Blood Drops', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.55,
          em: {
            x: track([[0.09, -7], [0.26, 8], [0.43, -3]]), y: 6,
            shape: 'ring', sx: 10, sy: 6, dir: 'dir', angle: -90, spread: 70,
            speed: 160, speedRnd: 0.5, rate: 0,
            bursts: [{ t: 0.1, n: 4 }, { t: 0.27, n: 4 }, { t: 0.44, n: 6 }], seed: 29,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.4, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'dot', p: {} }, size: 5, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.5, 0.9], [1, 0.3]),
            opacityOL: curve([0, 1], [0.7, 1], [1, 0]),
            grad: grad([0, [230, 70, 60]], [1, [150, 30, 26]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: false, stretch: 1.3,
            gravX: 0, gravY: 320, drag: 0.3, turbAmp: 6, turbFreq: 1.5, squash: 0, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_bm_jaw_top', name: 'Upper Fangs', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.55,
          opacity: track([[0, 0], [0.02, 1], [0.5, 1], [0.545, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: upper.id, p: {} }, size: 232,
            x: track(xKeys), y: track(upperKeys),
            scale: track(SNAPS.flatMap(({ t, s }) => [[t - 0.07, s + 0.08], [t, s]]).sort((a, b) => a[0] - b[0])),
            aspect: 1, rot: 0, color: [255, 255, 255], squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_bm_jaw_bottom', name: 'Lower Fangs', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.55,
          opacity: track([[0, 0], [0.02, 1], [0.5, 1], [0.545, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: lower.id, p: {} }, size: 232,
            x: track(xKeys), y: track(lowerKeys),
            scale: track(SNAPS.flatMap(({ t, s }) => [[t - 0.07, s + 0.08], [t, s]]).sort((a, b) => a[0] - b[0])),
            aspect: 1, rot: 0, color: [255, 255, 255], squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobBiteMulti, DOC_ID, import.meta.url)
