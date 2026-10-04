import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_claw'

// Spectral claw gash family: a translucent energy gouge with a hot ivory spine
// that bleeds out through amber into a crimson rim. Bodies stay fill-opacity
// ~0.75 so the cuts read as light, not pasted solids. Three variants differ in
// belly depth and tail hook so the rake feels like claws, not stamps.
const GASH_A_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="ga" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0" stop-color="#fff3d6"/>
      <stop offset="0.35" stop-color="#ffab5e"/>
      <stop offset="0.75" stop-color="#f23828"/>
      <stop offset="1" stop-color="#8e0f1c"/>
    </linearGradient>
  </defs>
  <path d="M242 68 C204 76 168 88 140 100 C118 110 96 118 74 130 C52 142 32 156 18 170 C56 158 102 140 148 122 C188 107 222 88 242 68 Z" fill="url(#ga)" fill-opacity="0.75" stroke="#571e12" stroke-opacity="0.38" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M232 82 C196 90 160 102 128 116 C98 129 66 146 40 162" fill="none" stroke="#ffcf8e" stroke-width="11" stroke-linecap="round" opacity="0.5"/>
  <path d="M232 82 C196 90 160 102 128 116 C98 129 66 146 40 162" fill="none" stroke="#fff8e4" stroke-width="6" stroke-linecap="round" opacity="0.85"/>
</svg>`

const GASH_B_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="gb" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0" stop-color="#fff3d6"/>
      <stop offset="0.35" stop-color="#ffab5e"/>
      <stop offset="0.75" stop-color="#f23828"/>
      <stop offset="1" stop-color="#8e0f1c"/>
    </linearGradient>
  </defs>
  <path d="M244 84 C210 84 172 94 140 108 C108 122 76 142 48 160 C36 168 26 178 20 188 C54 172 94 152 138 132 C180 114 220 98 244 84 Z" fill="url(#gb)" fill-opacity="0.75" stroke="#571e12" stroke-opacity="0.38" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M234 94 C200 100 162 110 128 124 C96 138 64 156 42 176" fill="none" stroke="#ffcf8e" stroke-width="11" stroke-linecap="round" opacity="0.5"/>
  <path d="M234 94 C200 100 162 110 128 124 C96 138 64 156 42 176" fill="none" stroke="#fff8e4" stroke-width="6" stroke-linecap="round" opacity="0.85"/>
</svg>`

const GASH_C_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="gc" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0" stop-color="#fff3d6"/>
      <stop offset="0.35" stop-color="#ffab5e"/>
      <stop offset="0.75" stop-color="#f23828"/>
      <stop offset="1" stop-color="#8e0f1c"/>
    </linearGradient>
  </defs>
  <path d="M238 62 C202 72 170 86 142 100 C114 114 88 130 64 146 C48 156 34 162 22 164 C54 156 94 142 136 124 C176 107 216 84 238 62 Z" fill="url(#gc)" fill-opacity="0.75" stroke="#571e12" stroke-opacity="0.38" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M228 74 C194 84 160 96 128 110 C100 122 72 138 50 154" fill="none" stroke="#ffcf8e" stroke-width="11" stroke-linecap="round" opacity="0.5"/>
  <path d="M228 74 C194 84 160 96 128 110 C100 122 72 138 50 154" fill="none" stroke="#fff8e4" stroke-width="6" stroke-linecap="round" opacity="0.85"/>
</svg>`

const gashA = texture('mob_claw_gash_a', GASH_A_SVG)
const gashB = texture('mob_claw_gash_b', GASH_B_SVG)
const gashC = texture('mob_claw_gash_c', GASH_C_SVG)
const TEXTURES = [gashA, gashB, gashC]

// Rake: enemy swipes from screen right, gashes drag down-left across the
// target. Marks sit along the perpendicular (~ -39 deg normal) so the three
// claws fan like toes. Slide vector = rake axis (-cos38, +sin38).
const SLIDE = 24
const DX = -0.79 * SLIDE
const DY = 0.62 * SLIDE

const GASHES = [
  { tex: gashC, id: 'lr_claw_gash_1', name: 'Gash One', x: 26, y: -30, rot: 46, t: 0.045, size: 196 },
  { tex: gashA, id: 'lr_claw_gash_2', name: 'Gash Two', x: 0, y: -2, rot: 38, t: 0.08, size: 212 },
  { tex: gashB, id: 'lr_claw_gash_3', name: 'Gash Three', x: -26, y: 26, rot: 30, t: 0.115, size: 204 },
]

const gashBody = ({ tex, id, name, x, y, rot, t, size }) => ({
  id, name, type: 'sprite', blend: 'normal',
  start: -0.02, end: 0.36,
  opacity: track([[t - 0.02, 0], [t, 0.85], [t + 0.13, 0.8], [t + 0.22, 0]]),
  sp: {
    sprite: { kind: 'tex', texId: tex.id, p: {} }, size,
    x: track([[t - 0.02, x - DX * 0.55], [t + 0.14, x + DX * 0.45]]),
    y: track([[t - 0.02, y - DY * 0.55], [t + 0.14, y + DY * 0.45]]),
    rot: track([[t - 0.02, rot + 6], [t + 0.12, rot]]),
    scale: track([[t - 0.02, 0.88], [t + 0.1, 1.02]]),
    aspect: 1, color: [255, 255, 255], squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
  },
})

const gashBloom = ({ tex, id, name, x, y, rot, t, size }) => ({
  id: `${id}_bloom`, name: `${name} Bloom`, type: 'sprite', blend: 'add',
  start: -0.02, end: 0.36,
  opacity: track([[t - 0.02, 0], [t + 0.005, 0.45], [t + 0.12, 0.38], [t + 0.2, 0]]),
  sp: {
    sprite: { kind: 'tex', texId: tex.id, p: {} }, size: size * 1.06,
    x: track([[t - 0.02, x - DX * 0.55], [t + 0.14, x + DX * 0.45]]),
    y: track([[t - 0.02, y - DY * 0.55], [t + 0.14, y + DY * 0.45]]),
    rot: track([[t - 0.02, rot + 6], [t + 0.12, rot]]),
    scale: track([[t - 0.02, 0.9], [t + 0.1, 1.04]]),
    aspect: 1, color: [255, 205, 150], squash: 0, glow: 0.55, glowSize: 1.7, glowBlur: 0.2, fps: 0,
  },
})

export function buildMobClaw() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Claw',
      comp: { w: 256, h: 192, dur: 0.36, fps: 30 },
      cam: { comp: 55 },
      exp: { cols: 4, rows: 3, frames: 11, cellW: 256, cellH: 192, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        {
          id: 'lr_claw_embers', name: 'Rake Embers', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.36,
          em: {
            x: track([[0.045, 26], [0.08, 0], [0.115, -26]]),
            y: track([[0.045, -30], [0.08, -2], [0.115, 26]]),
            shape: 'ring', sx: 12, sy: 8, dir: 'dir', angle: 205, spread: 55,
            speed: 240, speedRnd: 0.45, rate: 0,
            bursts: [{ t: 0.05, n: 8 }, { t: 0.085, n: 8 }, { t: 0.12, n: 9 }], seed: 13,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.3, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'ember', p: {} }, size: 9, sizeRnd: 0.45,
            sizeOL: curve([0, 1], [0.6, 0.7], [1, 0.1]),
            opacityOL: curve([0, 1], [0.5, 0.9], [1, 0]),
            grad: grad([0, [255, 252, 240]], [0.4, [255, 180, 100]], [1, [200, 60, 40]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 60, spinRnd: 0.6, alignVel: false, stretch: 0,
            gravX: -40, gravY: 110, drag: 2.2, turbAmp: 10, turbFreq: 1.5, squash: 0, glow: 0.5,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_claw_sparks', name: 'Cut Streaks', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.36,
          em: {
            x: track([[0.045, 26], [0.08, 0], [0.115, -26]]),
            y: track([[0.045, -30], [0.08, -2], [0.115, 26]]),
            shape: 'ring', sx: 14, sy: 8, dir: 'dir', angle: 200, spread: 40,
            speed: 300, speedRnd: 0.4, rate: 0,
            bursts: [{ t: 0.05, n: 5 }, { t: 0.085, n: 5 }, { t: 0.12, n: 6 }], seed: 17,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.22, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'streak', p: {} }, size: 8, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.6, 0.6], [1, 0.05]),
            opacityOL: curve([0, 1], [0.5, 0.85], [1, 0]),
            grad: grad([0, [255, 255, 245]], [0.45, [255, 160, 110]], [1, [190, 40, 30]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: true, stretch: 1.8,
            gravX: -30, gravY: 90, drag: 2.5, turbAmp: 6, turbFreq: 1.5, squash: 0, glow: 0.4,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_claw_flash', name: 'Rake Hit Flash', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.36,
          opacity: track([[0.115, 0], [0.135, 0.8], [0.24, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'star', p: { n: 6, inr: 0.25 } }, size: 92, x: -4, y: 0,
            scale: track([[0.115, 0.35], [0.17, 1.05], [0.26, 1.3]]), rot: 10,
            aspect: 1, color: [255, 238, 205], squash: 0, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        ...GASHES.map(gashBloom),
        ...GASHES.map(gashBody),
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobClaw, DOC_ID, import.meta.url)
