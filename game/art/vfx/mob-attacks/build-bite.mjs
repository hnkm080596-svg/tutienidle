import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'
import { JAW_LOWER_SVG, JAW_UPPER_SVG } from './mob-parts.mjs'

const DOC_ID = 'fx_mob_bite'

const UPPER_JAW_SVG = JAW_UPPER_SVG
const LOWER_JAW_SVG = JAW_LOWER_SVG

const upper = texture('mob_bite_upper', UPPER_JAW_SVG)
const lower = texture('mob_bite_lower', LOWER_JAW_SVG)
const TEXTURES = [upper, lower]

// Snap lands at t=0.15s: jaws rush in, lock with a small rebound, then the whole
// set fades while the white/red hit flash covers the contact point.
const upperKeys = [[0, -58], [0.055, -58], [0.15, -3], [0.185, -8], [0.26, -3], [0.34, -3]]
const lowerKeys = [[0, 58], [0.055, 58], [0.15, 3], [0.185, 8], [0.26, 3], [0.34, 3]]

export function buildMobBite() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Bite',
      comp: { w: 256, h: 192, dur: 0.34, fps: 30 },
      cam: { comp: 55 },
      exp: { cols: 5, rows: 2, frames: 10, cellW: 256, cellH: 192, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        {
          id: 'lr_bite_flash_white', name: 'Hit Flash', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.34,
          opacity: track([[0.13, 0], [0.155, 0.8], [0.27, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 140, x: 0, y: -4,
            scale: track([[0.13, 0.45], [0.17, 1.35], [0.27, 1.7]]),
            aspect: 1, rot: 0, color: [255, 250, 240], squash: 0, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_bite_flash_red', name: 'Red Bite Bloom', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.34,
          opacity: track([[0.14, 0], [0.175, 0.7], [0.29, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 190, x: 0, y: -4,
            scale: track([[0.14, 0.65], [0.21, 1.75]]),
            aspect: 1, rot: 0, color: [255, 84, 68], squash: 0, glow: 0.35, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_bite_spray', name: 'Fang Sparks', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.34,
          em: {
            x: 0, y: -4, shape: 'ring', sx: 6, sy: 6, dir: 'omni', angle: -90, spread: 40,
            speed: 240, speedRnd: 0.45, rate: 0, bursts: [{ t: 0.15, n: 10 }], seed: 7,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.3, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'streak', p: {} }, size: 9, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.6, 0.7], [1, 0.1]),
            opacityOL: curve([0, 1], [0.55, 0.9], [1, 0]),
            grad: grad([0, [255, 255, 255]], [0.5, [255, 190, 170]], [1, [200, 60, 50]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: true, stretch: 1.8,
            gravX: 0, gravY: 60, drag: 3, turbAmp: 8, turbFreq: 1.5, squash: 0, glow: 0.4,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_bite_jaw_top', name: 'Upper Fangs', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.34,
          opacity: track([[0, 0], [0.035, 1], [0.26, 1], [0.335, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: upper.id, p: {} }, size: 246, x: 0, y: track(upperKeys),
            scale: track([[0.055, 1.06], [0.15, 1]]), aspect: 1, rot: 0, color: [255, 255, 255],
            squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_bite_jaw_bottom', name: 'Lower Fangs', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.34,
          opacity: track([[0, 0], [0.035, 1], [0.26, 1], [0.335, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: lower.id, p: {} }, size: 246, x: 0, y: track(lowerKeys),
            scale: track([[0.055, 1.06], [0.15, 1]]), aspect: 1, rot: 0, color: [255, 255, 255],
            squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobBite, DOC_ID, import.meta.url)
