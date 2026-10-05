import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { curve, grad, texMeta, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_ram'

// Spectral ghost of the real iron-boar sprite (pre-rendered at
// art/vfx/mob-attacks/boar-spectral.png: alpha 0.78 + ivory wash) - reuse the
// game's own art translucified, per Minh, instead of a hand-drawn stand-in.
const BOAR_PNG = readFileSync(new URL('./boar-spectral.png', import.meta.url))
const boar = {
  id: `tex_mob_ram_boar_${createHash('sha256').update(BOAR_PNG).digest('hex').slice(0, 12)}`,
  name: 'mob ram boar',
}
const TEXTURES = [boar]
const PAYLOADS = { [boar.id]: `data:image/png;base64,${BOAR_PNG.toString('base64')}` }

// The spectral boar streaks in from the right edge and rams the target at
// t=0.115: small white-amber flash + glint, a short leftward spray, a few
// debris bits, and a low dust puff at feet level. A lagging ghost echo and
// a faint wisp wake sell the spectral read; impact stays under ~40% of the
// 256px cell.
const boarSp = xOff => ({
  sprite: { kind: 'tex', texId: boar.id, p: {} }, size: 200,
  x: track([[0, 230 + xOff], [0.11, 76 + xOff], [0.185, 52 + xOff]]),
  y: track([[0, -8], [0.11, -3], [0.185, -1]]),
  scale: track([[0, 0.92], [0.11, 1], [0.185, 1.02]]),
  aspect: 1, rot: track([[0, 0], [0.11, -6], [0.185, -4]]),
  color: [255, 255, 255], squash: 0.12, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
})

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
          id: 'lr_ram_glint', name: 'Impact Glint', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.4,
          opacity: track([[0.11, 0], [0.125, 0.8], [0.2, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'spark', p: {} }, size: 44, x: -12, y: 8,
            scale: track([[0.11, 0.5], [0.14, 1.1], [0.2, 1.4]]),
            aspect: 1, rot: 0, color: [255, 246, 220], squash: 0, glow: 0.4, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_ram_flash', name: 'Impact Flash', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.4,
          opacity: track([[0.105, 0], [0.125, 0.8], [0.25, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 78, x: -12, y: 10,
            scale: track([[0.105, 0.5], [0.15, 1.05], [0.25, 1.3]]),
            aspect: 1, rot: 0, color: [255, 236, 200], squash: 0, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_ram_boar', name: 'Spectral Boar', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.4,
          opacity: track([[0, 0.1], [0.02, 0.82], [0.125, 0.82], [0.19, 0]]),
          sp: boarSp(0),
        },
        {
          // Ghost double trailing the charge: same texture, offset behind,
          // dimmer - reads as the spectral wake of the lunge.
          id: 'lr_ram_echo', name: 'Boar Echo', type: 'sprite', blend: 'screen',
          start: -0.02, end: 0.4,
          opacity: track([[0, 0.06], [0.03, 0.4], [0.13, 0.36], [0.2, 0]]),
          sp: boarSp(55),
        },
        {
          // Faint wisp wake: slow soft dots born along the charge path that
          // linger a beat then lift off like spectral mist.
          id: 'lr_ram_wisps', name: 'Spectral Wake', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.16,
          opacity: 0.7,
          em: {
            x: track([[0, 244], [0.11, 90], [0.16, 74]]),
            y: track([[0, -4], [0.11, 0], [0.16, 2]]),
            shape: 'ring', sx: 26, sy: 14, dir: 'omni', angle: 0, spread: 360,
            speed: 14, speedRnd: 0.6, rate: 220, bursts: [], seed: 53,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.2, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'soft', p: {} }, size: 9, sizeRnd: 0.5,
            sizeOL: curve([0, 0.7], [1, 1.1]),
            opacityOL: curve([0, 0.55], [0.4, 0.5], [1, 0]),
            grad: grad([0, [255, 244, 214]], [0.6, [240, 205, 150]], [1, [210, 160, 100]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 10, spinRnd: 0.5, alignVel: false, stretch: 0,
            gravX: 0, gravY: -32, drag: 3.2, turbAmp: 14, turbFreq: 1.3, squash: 0, glow: 0.3,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_ram_streaks', name: 'Impact Streaks', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.4,
          opacity: 0.85,
          em: {
            x: -14, y: 8, shape: 'ring', sx: 9, sy: 6, dir: 'dir', angle: 185, spread: 65,
            speed: 250, speedRnd: 0.45, rate: 0, bursts: [{ t: 0.115, n: 8 }], seed: 37,
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
          id: 'lr_ram_embers', name: 'Impact Embers', type: 'emitter', blend: 'add',
          start: -0.02, end: 0.4,
          opacity: 0.8,
          em: {
            x: -12, y: 12, shape: 'ring', sx: 12, sy: 8, dir: 'omni', angle: 0, spread: 360,
            speed: 60, speedRnd: 0.55, rate: 0, bursts: [{ t: 0.115, n: 7 }], seed: 59,
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
          id: 'lr_ram_debris', name: 'Knock Debris', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.4,
          opacity: 0.85,
          em: {
            x: -10, y: 18, shape: 'ring', sx: 7, sy: 5, dir: 'dir', angle: -60, spread: 75,
            speed: 175, speedRnd: 0.5, rate: 0, bursts: [{ t: 0.115, n: 6 }], seed: 41,
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
          id: 'lr_ram_dust', name: 'Dust Puff', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.4,
          opacity: 0.8,
          em: {
            x: -14, y: 48, shape: 'ring', sx: 14, sy: 5, dir: 'dir', angle: -90, spread: 115,
            speed: 85, speedRnd: 0.45, rate: 0, bursts: [{ t: 0.115, n: 8 }, { t: 0.15, n: 4 }], seed: 43,
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

writeOnRun(buildMobRam, DOC_ID, import.meta.url)
