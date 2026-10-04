import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_claw'

// One claw gash: a crescent stroke raking top-left to bottom-right, deep red
// body with a white-hot leading edge on its cutting side and a dark rim.
const GASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="gash" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffefe2"/>
      <stop offset="0.5" stop-color="#ff8a5c"/>
      <stop offset="1" stop-color="#a81f16"/>
    </linearGradient>
  </defs>
  <path d="M14 118 C90 100 180 90 246 90 C176 108 92 122 14 118 Z" fill="url(#gash)" stroke="#4d0f0a" stroke-width="5" stroke-linejoin="round"/>
  <path d="M14 118 C92 122 176 108 246 90" fill="none" stroke="#fff3e6" stroke-width="6" stroke-linecap="round"/>
  <path d="M60 112 C116 102 172 96 216 94" fill="none" stroke="#7d1a10" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
</svg>`

const gash = texture('mob_claw_gash', GASH_SVG)
const TEXTURES = [gash]

// Rake direction 40 deg: dir vector (0.77, 0.64), gash offsets sit on the
// perpendicular (0.64, -0.77) so the three marks stay parallel, side by side.
const GASHES = [
  { id: 'lr_claw_gash_1', name: 'Gash One', x: 22, y: -26, t: 0.04 },
  { id: 'lr_claw_gash_2', name: 'Gash Two', x: 0, y: 0, t: 0.09 },
  { id: 'lr_claw_gash_3', name: 'Gash Three', x: -22, y: 26, t: 0.14 },
]

const SLIDE = 16
const gashLayer = ({ id, name, x, y, t }) => ({
  id, name, type: 'sprite', blend: 'normal',
  start: -0.02, end: 0.36,
  // Fades finish before the last exported frame (frame 10 samples ~t=0.33) so
  // the one-shot clip despawns with no visible tail pop.
  opacity: track([[t - 0.015, 0], [t + 0.012, 1], [t + 0.16, 1], [Math.min(t + 0.2, 0.34), 0]]),
  sp: {
    sprite: { kind: 'tex', texId: gash.id, p: {} }, size: 230,
    x: track([[t - 0.015, x - SLIDE * 0.77], [t + 0.1, x + SLIDE * 0.77]]),
    y: track([[t - 0.015, y - SLIDE * 0.64], [t + 0.1, y + SLIDE * 0.64]]),
    scale: track([[t - 0.015, 0.82], [t + 0.09, 1.03]]),
    aspect: 1, rot: 38, color: [255, 255, 255], squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
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
          id: 'lr_claw_sparks', name: 'Rake Sparks', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.36,
          em: {
            x: track([[0.04, 22], [0.09, 0], [0.14, -22]]),
            y: track([[0.04, -26], [0.09, 0], [0.14, 26]]),
            shape: 'ring', sx: 8, sy: 8, dir: 'dir', angle: 40, spread: 30,
            speed: 280, speedRnd: 0.4, rate: 0,
            bursts: [{ t: 0.04, n: 7 }, { t: 0.09, n: 7 }, { t: 0.14, n: 7 }], seed: 11,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.24, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'streak', p: {} }, size: 8, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.6, 0.6], [1, 0.05]),
            opacityOL: curve([0, 1], [0.5, 0.85], [1, 0]),
            grad: grad([0, [255, 255, 245]], [0.45, [255, 150, 110]], [1, [190, 40, 30]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: true, stretch: 1.7,
            gravX: 0, gravY: 90, drag: 2.5, turbAmp: 6, turbFreq: 1.5, squash: 0, glow: 0.4,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        ...GASHES.map(gashLayer),
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobClaw, DOC_ID, import.meta.url)
