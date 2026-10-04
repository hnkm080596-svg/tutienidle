import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'
import { RAM_WEDGE_SVG } from './mob-parts.mjs'

const DOC_ID = 'fx_mob_ram'

const wedge = texture('mob_ram_wedge', RAM_WEDGE_SVG)
const TEXTURES = [wedge]

// Charge lands at t=0.12: the wedge streaks in from the right, hits with a
// white-orange burst, radiating impact streaks, dust kick and small debris.
export function buildMobRam() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Ram',
      comp: { w: 256, h: 192, dur: 0.4, fps: 30 },
      cam: { comp: 55 },
      exp: { cols: 4, rows: 3, frames: 12, cellW: 256, cellH: 192, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        {
          id: 'lr_ram_flash', name: 'Impact Flash', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.4,
          opacity: track([[0.105, 0], [0.13, 0.95], [0.26, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 160, x: -6, y: -2,
            scale: track([[0.105, 0.4], [0.16, 1.5], [0.26, 1.9]]),
            aspect: 1, rot: 0, color: [255, 236, 205], squash: 0, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_ram_burst', name: 'Impact Starburst', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.4,
          opacity: track([[0.11, 0], [0.14, 0.9], [0.3, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'star', p: { n: 8, inner: 0.22 } }, size: 190, x: -6, y: -2,
            scale: track([[0.11, 0.35], [0.17, 1.1], [0.3, 1.5]]), rot: 8,
            aspect: 1, color: [255, 214, 150], squash: 0, glow: 0.4, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_ram_streaks', name: 'Impact Streaks', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.4,
          em: {
            x: -6, y: -2, shape: 'ring', sx: 10, sy: 8, dir: 'dir', angle: 180, spread: 95,
            speed: 300, speedRnd: 0.45, rate: 0, bursts: [{ t: 0.12, n: 12 }], seed: 37,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.26, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'streak', p: {} }, size: 11, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.55, 0.75], [1, 0.05]),
            opacityOL: curve([0, 1], [0.55, 0.9], [1, 0]),
            grad: grad([0, [255, 255, 240]], [0.5, [255, 190, 120]], [1, [190, 90, 40]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: true, stretch: 2,
            gravX: 0, gravY: 140, drag: 2.6, turbAmp: 8, turbFreq: 1.5, squash: 0, glow: 0.45,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_ram_debris', name: 'Knock Debris', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.4,
          em: {
            x: -4, y: 4, shape: 'ring', sx: 8, sy: 6, dir: 'dir', angle: -60, spread: 80,
            speed: 190, speedRnd: 0.5, rate: 0, bursts: [{ t: 0.12, n: 9 }], seed: 41,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.42, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'shard', p: {} }, size: 8, sizeRnd: 0.45,
            sizeOL: curve([0, 1], [0.8, 0.9], [1, 0.3]),
            opacityOL: curve([0, 1], [0.75, 1], [1, 0]),
            grad: grad([0, [200, 160, 110]], [0.6, [140, 100, 66]], [1, [90, 62, 40]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 220, spinRnd: 0.8, alignVel: false, stretch: 0,
            gravX: 0, gravY: 420, drag: 0.35, turbAmp: 10, turbFreq: 1.5, squash: 0, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_ram_dust', name: 'Dust Kick', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.4,
          em: {
            x: -8, y: 8, shape: 'ring', sx: 12, sy: 6, dir: 'dir', angle: 180, spread: 70,
            speed: 140, speedRnd: 0.4, rate: 0, bursts: [{ t: 0.12, n: 8 }, { t: 0.16, n: 5 }], seed: 43,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.4, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'smoke', p: {} }, size: 20, sizeRnd: 0.4,
            sizeOL: curve([0, 0.5], [0.45, 1], [1, 1.35]),
            opacityOL: curve([0, 0], [0.25, 0.75], [1, 0]),
            grad: grad([0, [220, 190, 150]], [0.55, [170, 135, 95]], [1, [120, 90, 62]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 30, spinRnd: 0.5, alignVel: false, stretch: 0,
            gravX: 0, gravY: -14, drag: 2.4, turbAmp: 12, turbFreq: 1.2, squash: 0.4, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_ram_wedge', name: 'Charge Wedge', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.4,
          opacity: track([[0.02, 0], [0.045, 1], [0.13, 1], [0.17, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: wedge.id, p: {} }, size: 200,
            x: track([[0.02, 150], [0.115, 0]]), y: track([[0.02, -8], [0.115, -2]]),
            scale: track([[0.02, 0.7], [0.115, 1]]),
            aspect: 1, rot: 0, color: [255, 255, 255], squash: 0.15, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobRam, DOC_ID, import.meta.url)
