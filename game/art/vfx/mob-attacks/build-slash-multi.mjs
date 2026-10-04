import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'
import { SLASH_BLADE_SVG } from './mob-parts.mjs'

const DOC_ID = 'fx_mob_slash_multi'

const blade = texture('mob_slashm_blade', SLASH_BLADE_SVG)
const TEXTURES = [blade]

// Three rapid cuts fanning through the target at different angles
// (near-horizontal, near-vertical, steep diagonal) - the classic flurry
// asterisk. Each cut carries its own edge glow and spark burst.
const CUTS = [
  { t: 0.05, rot: 14, x: -10, y: -16 },
  { t: 0.17, rot: 88, x: 8, y: -4 },
  { t: 0.29, rot: 148, x: -4, y: 8 },
]

const bladeLayer = ({ t, rot, x, y, id, name, blend, color, glow }) => ({
  id, name, type: 'sprite', blend,
  start: -0.02, end: 0.5,
  opacity: track([[t - 0.015, 0], [t + 0.012, 1], [t + 0.13, 0.9], [t + 0.2, 0]]),
  sp: {
    sprite: { kind: 'tex', texId: blade.id, p: {} }, size: 185, x, y,
    rot: track([[t - 0.015, rot - 14], [t + 0.09, rot + 10]]),
    scale: track([[t - 0.015, 0.9], [t + 0.09, 1.05]]),
    aspect: 1, color, squash: 0, glow, glowSize: 1.6, glowBlur: 0.15, fps: 0,
  },
})

export function buildMobSlashMulti() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Slash Multi',
      comp: { w: 256, h: 192, dur: 0.5, fps: 30 },
      cam: { comp: 55 },
      exp: { cols: 5, rows: 3, frames: 15, cellW: 256, cellH: 192, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        ...CUTS.map((c, i) => bladeLayer({ ...c, id: `lr_sm_glow_${i + 1}`, name: `Edge ${i + 1}`, blend: 'add', color: [255, 190, 150], glow: 0.5 })),
        {
          id: 'lr_sm_sparks', name: 'Cut Sparks', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.5,
          em: {
            x: track([[0.05, -10], [0.17, 8], [0.29, -4]]), y: track([[0.05, -16], [0.17, -4], [0.29, 8]]),
            shape: 'ring', sx: 12, sy: 12, dir: 'omni', angle: -90, spread: 40,
            speed: 280, speedRnd: 0.5, rate: 0,
            bursts: [{ t: 0.06, n: 7 }, { t: 0.18, n: 7 }, { t: 0.3, n: 9 }], seed: 71,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.26, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'streak', p: {} }, size: 9, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.55, 0.7], [1, 0.05]),
            opacityOL: curve([0, 1], [0.55, 0.95], [1, 0]),
            grad: grad([0, [255, 255, 245]], [0.5, [255, 160, 110]], [1, [200, 50, 40]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: true, stretch: 1.9,
            gravX: 0, gravY: 160, drag: 2.6, turbAmp: 8, turbFreq: 1.5, squash: 0, glow: 0.45,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        ...CUTS.map((c, i) => bladeLayer({ ...c, id: `lr_sm_blade_${i + 1}`, name: `Cut ${i + 1}`, blend: 'normal', color: [255, 255, 255], glow: 0 })),
        {
          id: 'lr_sm_flash', name: 'Final Flash', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.5,
          opacity: track([[0.28, 0], [0.31, 0.85], [0.44, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 150, x: 0, y: 0,
            scale: track([[0.28, 0.4], [0.37, 1.5]]),
            aspect: 1, rot: 0, color: [255, 244, 230], squash: 0, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobSlashMulti, DOC_ID, import.meta.url)
