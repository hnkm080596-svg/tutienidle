import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { curve, grad, texMeta, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_ram_multi'

// Same spectral iron-boar ghost as fx_mob_ram (shared pre-rendered PNG).
const BOAR_PNG = readFileSync(new URL('./boar-spectral.png', import.meta.url))
const boar = {
  id: `tex_mob_rammulti_boar_${createHash('sha256').update(BOAR_PNG).digest('hex').slice(0, 12)}`,
  name: 'mob rammulti boar',
}
const TEXTURES = [boar]
const PAYLOADS = { [boar.id]: `data:image/png;base64,${BOAR_PNG.toString('base64')}` }

// Two-hit charge: the boar rams the target at t=0.115, recoils back out to
// the right still visible (a spectral attacker bouncing off), then rams home
// again at t=0.375 on a slightly lower line. Each hit gets its own small
// white-amber flash + glint, leftward spray, debris and a foot-level dust
// puff; a ghost echo and wisp wake trail both charges.
const T_HIT1 = 0.115
const T_HIT2 = 0.375

const boarX = xOff => track([
  [0, 232 + xOff], [T_HIT1, 74 + xOff], [0.17, 68 + xOff],
  [0.3, 148 + xOff], [T_HIT2, 70 + xOff], [0.46, 60 + xOff],
])
const boarY = track([[0, -10], [T_HIT1, -3], [0.3, -6], [T_HIT2, 6], [0.46, 8]])
const boarRot = track([[0, 0], [T_HIT1, -6], [0.22, 5], [0.3, 4], [T_HIT2, -7], [0.46, -3]])

const boarSp = xOff => ({
  sprite: { kind: 'tex', texId: boar.id, p: {} }, size: 200,
  x: boarX(xOff), y: boarY,
  scale: track([[0, 0.92], [T_HIT1, 1], [0.3, 0.96], [T_HIT2, 1.04], [0.46, 1.05]]),
  aspect: 1, rot: boarRot,
  color: [255, 255, 255], squash: 0.12, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
})

export function buildMobRamMulti() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Ram Multi',
      comp: { w: 256, h: 192, dur: 0.56, fps: 30 },
      cam: { comp: 55 },
      exp: { cols: 5, rows: 4, frames: 17, cellW: 256, cellH: 192, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        {
          id: 'lr_rm_glint1', name: 'Glint Hit 1', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.56,
          opacity: track([[0.108, 0], [0.125, 0.8], [0.2, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'spark', p: {} }, size: 42, x: -12, y: 4,
            scale: track([[0.108, 0.5], [0.14, 1.1], [0.2, 1.4]]),
            aspect: 1, rot: 0, color: [255, 246, 220], squash: 0, glow: 0.4, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_rm_glint2', name: 'Glint Hit 2', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.56,
          opacity: track([[0.368, 0], [0.385, 0.85], [0.47, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'spark', p: {} }, size: 48, x: -12, y: 14,
            scale: track([[0.368, 0.5], [0.4, 1.15], [0.47, 1.45]]),
            aspect: 1, rot: 0, color: [255, 246, 220], squash: 0, glow: 0.4, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_rm_flash1', name: 'Flash Hit 1', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.56,
          opacity: track([[0.105, 0], [0.125, 0.78], [0.24, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 76, x: -12, y: 6,
            scale: track([[0.105, 0.5], [0.15, 1.05], [0.24, 1.3]]),
            aspect: 1, rot: 0, color: [255, 236, 200], squash: 0, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_rm_flash2', name: 'Flash Hit 2', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.56,
          opacity: track([[0.365, 0], [0.385, 0.85], [0.5, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 88, x: -12, y: 16,
            scale: track([[0.365, 0.5], [0.41, 1.05], [0.5, 1.35]]),
            aspect: 1, rot: 0, color: [255, 236, 200], squash: 0, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_rm_boar', name: 'Spectral Boar', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.56,
          opacity: track([[0, 0.08], [0.025, 0.82], [0.16, 0.8], [0.26, 0.55], [0.32, 0.6], [0.35, 0.85], [0.43, 0.8], [0.5, 0]]),
          sp: boarSp(0),
        },
        {
          // Ghost double trailing the boar through both charges.
          id: 'lr_rm_echo', name: 'Boar Echo', type: 'sprite', blend: 'screen',
          start: -0.02, end: 0.56,
          opacity: track([[0, 0.05], [0.04, 0.4], [0.18, 0.28], [0.3, 0.22], [0.37, 0.42], [0.47, 0]]),
          sp: boarSp(52),
        },
        {
          // Wisp wake: faint dots born along the boar's whole path that linger
          // and lift off like spectral mist.
          id: 'lr_rm_wisps', name: 'Spectral Wake', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.46,
          opacity: 0.7,
          em: {
            x: boarX(14), y: track([[0, -6], [T_HIT1, 0], [0.3, -3], [T_HIT2, 9], [0.46, 11]]),
            shape: 'ring', sx: 26, sy: 14, dir: 'omni', angle: 0, spread: 360,
            speed: 14, speedRnd: 0.6, rate: 170, bursts: [], seed: 53,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.22, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'soft', p: {} }, size: 9, sizeRnd: 0.5,
            sizeOL: curve([0, 0.7], [1, 1.1]),
            opacityOL: curve([0, 0.55], [0.4, 0.5], [1, 0]),
            grad: grad([0, [255, 244, 214]], [0.6, [240, 205, 150]], [1, [210, 160, 100]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 10, spinRnd: 0.5, alignVel: false, stretch: 0,
            gravX: 0, gravY: -32, drag: 3.2, turbAmp: 14, turbFreq: 1.3, squash: 0, glow: 0.3,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_rm_streaks', name: 'Impact Streaks', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.56,
          opacity: 0.85,
          em: {
            x: -14, y: track([[0.11, 4], [0.3, 4], [0.375, 14]]), shape: 'ring', sx: 9, sy: 6,
            dir: 'dir', angle: 185, spread: 65,
            speed: 250, speedRnd: 0.45, rate: 0,
            bursts: [{ t: T_HIT1, n: 8 }, { t: T_HIT2, n: 10 }], seed: 37,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.22, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'streak', p: {} }, size: 9, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.55, 0.7], [1, 0.05]),
            opacityOL: curve([0, 0.95], [0.55, 0.85], [1, 0]),
            grad: grad([0, [255, 255, 240]], [0.5, [255, 196, 130]], [1, [200, 105, 48]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: true, stretch: 2,
            gravX: 0, gravY: 120, drag: 2.6, turbAmp: 8, turbFreq: 1.5, squash: 0, glow: 0.4,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_rm_embers', name: 'Impact Embers', type: 'emitter', blend: 'add',
          start: -0.02, end: 0.56,
          opacity: 0.8,
          em: {
            x: -12, y: track([[0.11, 8], [0.3, 8], [0.375, 18]]), shape: 'ring', sx: 12, sy: 8,
            dir: 'omni', angle: 0, spread: 360,
            speed: 60, speedRnd: 0.55, rate: 0,
            bursts: [{ t: T_HIT1, n: 6 }, { t: T_HIT2, n: 8 }], seed: 59,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.5, lifeRnd: 0.45, sprite: { kind: 'shape', id: 'ember', p: {} }, size: 6, sizeRnd: 0.5,
            sizeOL: curve([0, 1], [0.7, 0.9], [1, 0.3]),
            opacityOL: curve([0, 0.9], [0.5, 0.8], [1, 0]),
            grad: grad([0, [255, 240, 200]], [0.55, [255, 185, 105]], [1, [190, 100, 45]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 60, spinRnd: 0.6, alignVel: false, stretch: 0,
            gravX: 0, gravY: -26, drag: 1.6, turbAmp: 22, turbFreq: 1.4, squash: 0, glow: 0.6,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_rm_debris', name: 'Knock Debris', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.56,
          opacity: 0.85,
          em: {
            x: -10, y: track([[0.11, 16], [0.3, 16], [0.375, 26]]), shape: 'ring', sx: 7, sy: 5,
            dir: 'dir', angle: -60, spread: 75,
            speed: 175, speedRnd: 0.5, rate: 0,
            bursts: [{ t: T_HIT1, n: 6 }, { t: T_HIT2, n: 7 }], seed: 41,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.4, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'shard', p: {} }, size: 7, sizeRnd: 0.45,
            sizeOL: curve([0, 1], [0.8, 0.9], [1, 0.3]),
            opacityOL: curve([0, 0.8], [0.75, 0.9], [1, 0]),
            grad: grad([0, [205, 165, 115]], [0.6, [145, 105, 68]], [1, [95, 64, 42]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 220, spinRnd: 0.8, alignVel: false, stretch: 0,
            gravX: 0, gravY: 400, drag: 0.35, turbAmp: 10, turbFreq: 1.5, squash: 0, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_rm_dust', name: 'Dust Kick', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.56,
          opacity: 0.8,
          em: {
            x: -14, y: 52, shape: 'ring', sx: 14, sy: 5, dir: 'dir', angle: -90, spread: 115,
            speed: 85, speedRnd: 0.45, rate: 0,
            bursts: [{ t: T_HIT1, n: 7 }, { t: 0.15, n: 3 }, { t: T_HIT2, n: 9 }, { t: 0.42, n: 4 }], seed: 43,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.42, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'smoke', p: {} }, size: 18, sizeRnd: 0.4,
            sizeOL: curve([0, 0.5], [0.45, 1], [1, 1.3]),
            opacityOL: curve([0, 0], [0.25, 0.6], [1, 0]),
            grad: grad([0, [226, 196, 156]], [0.55, [178, 142, 100]], [1, [126, 96, 66]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 30, spinRnd: 0.5, alignVel: false, stretch: 0,
            gravX: 0, gravY: -16, drag: 2.4, turbAmp: 12, turbFreq: 1.2, squash: 0.4, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
      ],
    },
    tex: PAYLOADS,
  }
}

writeOnRun(buildMobRamMulti, DOC_ID, import.meta.url)
