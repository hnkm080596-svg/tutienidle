import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'
import { STOMP_SOLE_SVG } from './mob-parts.mjs'

const DOC_ID = 'fx_mob_stomp'

const sole = texture('mob_stomp_sole', STOMP_SOLE_SVG)
const TEXTURES = [sole]

// Grounded anchor: comp y ~= +0.35*h under center with h=192.
const FEET = 58

// Stomp lands at t=0.13: the sole drops from above, squashes on impact,
// kicks a dust ring + rock shards and leaves a ground dent that fades.
export function buildMobStomp() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Stomp',
      comp: { w: 256, h: 192, dur: 0.42, fps: 30 },
      cam: { comp: 32 },
      exp: { cols: 5, rows: 3, frames: 13, cellW: 256, cellH: 192, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        {
          id: 'lr_stomp_sole', name: 'Dropping Sole', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.42,
          opacity: track([[0.02, 0], [0.045, 1], [0.34, 1], [0.42, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: sole.id, p: {} }, size: 210,
            x: 0, y: track([[0.02, -160], [0.13, FEET - 48], [0.42, FEET - 48]]),
            // squash is static-only; the landing pinch is faked with a scale dip.
            scale: track([[0.02, 0.9], [0.13, 1], [0.155, 0.86], [0.24, 1]]),
            aspect: 1, rot: 0, color: [255, 255, 255],
            squash: 0.62,
            glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_stomp_dent', name: 'Ground Dent', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.42,
          opacity: track([[0.12, 0], [0.16, 0.55], [0.36, 0.5], [0.42, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 120, x: 0, y: FEET + 8,
            scale: track([[0.12, 0.5], [0.18, 1.1], [0.42, 1.3]]),
            aspect: 1, rot: 0, color: [40, 26, 16], squash: 0.55, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_stomp_flash', name: 'Impact Flash', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.42,
          opacity: track([[0.125, 0], [0.15, 0.85], [0.26, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 150, x: 0, y: FEET - 12,
            scale: track([[0.125, 0.4], [0.18, 1.5]]),
            aspect: 1, rot: 0, color: [255, 232, 190], squash: 0.4, glow: 0.45, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_stomp_ring', name: 'Dust Ring', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.42,
          opacity: track([[0.125, 0], [0.16, 0.7], [0.38, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'ring', p: { th: 0.16 } }, size: 190, x: 0, y: FEET,
            scale: track([[0.125, 0.25], [0.38, 2.2]]),
            aspect: 1, rot: 0, color: [238, 196, 130], squash: 0.5, glow: 0.3, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_stomp_dust', name: 'Dust Cloud', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.42,
          em: {
            x: 0, y: FEET - 2, shape: 'ring', sx: 14, sy: 5, dir: 'out', angle: -90, spread: 30,
            speed: 165, speedRnd: 0.35, rate: 0, bursts: [{ t: 0.13, n: 13 }, { t: 0.18, n: 7 }], seed: 47,
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
          id: 'lr_stomp_rocks', name: 'Thrown Rocks', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.42,
          em: {
            x: 0, y: FEET - 4, shape: 'point', sx: 10, sy: 5, dir: 'dir', angle: -90, spread: 75,
            speed: 220, speedRnd: 0.45, rate: 0, bursts: [{ t: 0.13, n: 10 }], seed: 53,
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
          id: 'lr_stomp_shadow', name: 'Sole Shadow', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.42,
          opacity: track([[0.02, 0], [0.1, 0.35], [0.13, 0.55], [0.3, 0.4], [0.42, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 150, x: 0, y: FEET + 6,
            scale: track([[0.02, 1.3], [0.13, 0.9]]),
            aspect: 1, rot: 0, color: [22, 14, 9], squash: 0.5, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobStomp, DOC_ID, import.meta.url)
