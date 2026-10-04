import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_slash_multi'

// Same spectral blade cut as the single slashes, reused per cut: translucent
// crimson body bleeding through amber into a hot ivory spine, thin warm rim,
// pointed both ends, fill ~0.74 alpha so it reads as light.
const BLADE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bd" x1="0" y1="0" x2="0.12" y2="1">
      <stop offset="0" stop-color="#fff9ea"/>
      <stop offset="0.3" stop-color="#ffcf8e"/>
      <stop offset="0.7" stop-color="#f23828"/>
      <stop offset="1" stop-color="#a81520"/>
    </linearGradient>
  </defs>
  <path d="M 246 58 C 204 70 160 88 120 108 C 82 128 44 158 12 190 C 62 168 114 146 162 124 C 200 104 232 82 246 58 Z" fill="url(#bd)" fill-opacity="0.74" stroke="#6b2416" stroke-opacity="0.36" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M 238 70 C 202 80 166 94 132 110 C 100 126 68 148 42 170" fill="none" stroke="#ffcf8e" stroke-width="11" stroke-linecap="round" opacity="0.5"/>
  <path d="M 238 70 C 202 80 166 94 132 110 C 100 126 68 148 42 170" fill="none" stroke="#fff8e4" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
</svg>`

const blade = texture('mob_slashm_blade', BLADE_SVG)
const TEXTURES = [blade]

// Three rapid cuts fanning through the target at different angles
// (near-horizontal, near-vertical, steep diagonal) - the classic flurry
// asterisk. Each cut carries its own bloom and spark burst; a small star
// pops on the final cut instead of a frame-covering flash.
const CUTS = [
  { t: 0.05, rot: 14, x: -10, y: -16 },
  { t: 0.17, rot: 88, x: 8, y: -4 },
  { t: 0.29, rot: 148, x: -4, y: 8 },
]

const bladeLayer = ({ t, rot, x, y, id, name, blend, color, glow, opPeak, opHold }) => ({
  id, name, type: 'sprite', blend,
  start: -0.02, end: 0.5,
  opacity: track([[t - 0.015, 0], [t + 0.012, opPeak], [t + 0.13, opHold], [t + 0.2, 0]]),
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
        ...CUTS.map((c, i) => bladeLayer({
          ...c, id: `lr_sm_bloom_${i + 1}`, name: `Bloom ${i + 1}`, blend: 'add',
          color: [255, 210, 160], glow: 0.55, opPeak: 0.45, opHold: 0.4,
        })),
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
        {
          id: 'lr_sm_embers', name: 'Trail Embers', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.5,
          em: {
            x: track([[0.05, -8], [0.29, -2]]), y: track([[0.05, -10], [0.29, 6]]),
            shape: 'ring', sx: 10, sy: 10, dir: 'omni', angle: -90, spread: 60,
            speed: 150, speedRnd: 0.5, rate: 0,
            bursts: [{ t: 0.08, n: 4 }, { t: 0.2, n: 4 }, { t: 0.32, n: 6 }], seed: 73,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.3, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'ember', p: {} }, size: 8, sizeRnd: 0.45,
            sizeOL: curve([0, 1], [0.6, 0.7], [1, 0.1]),
            opacityOL: curve([0, 1], [0.5, 0.9], [1, 0]),
            grad: grad([0, [255, 250, 235]], [0.4, [255, 185, 105]], [1, [205, 65, 42]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 50, spinRnd: 0.6, alignVel: false, stretch: 0,
            gravX: -20, gravY: 150, drag: 2.2, turbAmp: 9, turbFreq: 1.5, squash: 0, glow: 0.5,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        ...CUTS.map((c, i) => bladeLayer({
          ...c, id: `lr_sm_blade_${i + 1}`, name: `Cut ${i + 1}`, blend: 'normal',
          color: [255, 255, 255], glow: 0, opPeak: 0.85, opHold: 0.8,
        })),
        {
          id: 'lr_sm_flash', name: 'Final Flash', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.5,
          opacity: track([[0.29, 0], [0.315, 0.8], [0.44, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'star', p: { n: 6, inr: 0.26 } }, size: 92, x: -2, y: 4,
            scale: track([[0.29, 0.4], [0.36, 1.05], [0.44, 1.25]]), rot: 20,
            aspect: 1, color: [255, 238, 205], squash: 0.3, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobSlashMulti, DOC_ID, import.meta.url)
