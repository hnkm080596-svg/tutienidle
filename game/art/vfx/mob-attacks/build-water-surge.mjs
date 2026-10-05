import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_water_surge'

// Translucent spectral wave curling over the target, crashing right to left
// (enemy side toward the player): azure body, scalloped foam cap on the lip,
// dark inner curl, trailing spray streaks and stray droplets.
const CREST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8fd8ff"/>
      <stop offset="1" stop-color="#1a6fd0"/>
    </linearGradient>
  </defs>
  <path d="M216 150 L236 134 M204 120 L226 106 M190 96 L212 84" fill="none" stroke="#cfeeff" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
  <path d="M232 196 C196 96 116 56 56 84 C28 98 20 128 38 150 C52 168 74 168 84 156 C68 152 60 138 68 122 C78 102 108 102 138 120 C168 138 194 166 208 196 Z"
    fill="url(#body)" opacity="0.78"/>
  <path d="M84 156 C68 152 60 138 68 122 C78 102 108 102 138 120 C152 129 166 141 178 156 C160 148 138 138 116 140 C96 142 84 148 84 156 Z" fill="#0d4f9e" opacity="0.6"/>
  <path d="M196 132 C160 84 104 68 58 88 C42 96 34 110 36 124 C44 108 60 96 80 92 C114 84 152 100 178 128 C186 136 192 144 196 152 Z" fill="#f4fbff" opacity="0.95"/>
  <g fill="#ffffff" opacity="0.95">
    <circle cx="178" cy="118" r="9"/>
    <circle cx="158" cy="104" r="10"/>
    <circle cx="136" cy="94" r="10"/>
    <circle cx="112" cy="88" r="10"/>
    <circle cx="88" cy="88" r="9"/>
    <circle cx="66" cy="94" r="8"/>
    <circle cx="50" cy="106" r="7"/>
  </g>
  <circle cx="28" cy="88" r="6" fill="#f4fbff"/>
  <circle cx="18" cy="116" r="4" fill="#dff3ff"/>
  <circle cx="34" cy="66" r="4" fill="#f4fbff"/>
</svg>`

const crest = texture('mob_water_crest', CREST_SVG)
const TEXTURES = [crest]

const FEET = 58

export function buildMobWaterSurge() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Water Surge',
      comp: { w: 256, h: 192, dur: 0.42, fps: 30 },
      cam: { comp: 32 },
      exp: { cols: 5, rows: 3, frames: 13, cellW: 256, cellH: 192, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        {
          id: 'lr_water_drops', name: 'Spray Droplets', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.42,
          em: {
            x: -10, y: FEET - 30, shape: 'ring', sx: 24, sy: 16, dir: 'omni', angle: -90, spread: 40,
            speed: 250, speedRnd: 0.5, rate: 0, bursts: [{ t: 0.1, n: 12 }], seed: 41,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.5, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'dot', p: {} }, size: 5.5, sizeRnd: 0.5,
            sizeOL: curve([0, 1], [0.7, 0.8], [1, 0.3]),
            opacityOL: curve([0, 1], [0.7, 0.9], [1, 0]),
            grad: grad([0, [245, 252, 255]], [0.6, [170, 220, 250]], [1, [110, 180, 235]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: true, stretch: 1.4,
            gravX: 0, gravY: 360, drag: 0.6, turbAmp: 8, turbFreq: 1.5, squash: 0, glow: 0.3,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_water_crown', name: 'Splash Crown', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.42,
          em: {
            x: 0, y: FEET, shape: 'ring', sx: 16, sy: 5, dir: 'dir', angle: -90, spread: 58,
            speed: 200, speedRnd: 0.4, rate: 0, bursts: [{ t: 0.02, n: 15 }], seed: 43,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.5, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'blob', p: {} }, size: 14, sizeRnd: 0.4,
            sizeOL: curve([0, 0.8], [0.4, 1.1], [1, 0.4]),
            opacityOL: curve([0, 0.95], [0.75, 0.8], [1, 0]),
            grad: grad([0, [240, 251, 255]], [0.45, [110, 196, 245]], [1, [34, 110, 200]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 120, spinRnd: 1, alignVel: true, stretch: 1.2,
            gravX: 0, gravY: 330, drag: 0.8, turbAmp: 12, turbFreq: 1.4, squash: 0.5, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_water_column', name: 'Rebound Column', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.42,
          em: {
            x: 4, y: FEET - 2, shape: 'point', sx: 5, sy: 4, dir: 'dir', angle: -90, spread: 14,
            speed: 310, speedRnd: 0.3, rate: 0, bursts: [{ t: 0.05, n: 9 }], seed: 47,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.45, lifeRnd: 0.3, sprite: { kind: 'shape', id: 'blob', p: {} }, size: 10, sizeRnd: 0.35,
            sizeOL: curve([0, 0.7], [0.5, 1.15], [1, 0.3]),
            opacityOL: curve([0, 0.9], [0.7, 0.75], [1, 0]),
            grad: grad([0, [255, 255, 255]], [0.5, [160, 216, 250]], [1, [70, 150, 225]]),
            tintTex: false, rot: 0, rotRnd: 0.5, spin: 90, spinRnd: 0.6, alignVel: true, stretch: 1.6,
            gravX: 0, gravY: 300, drag: 0.8, turbAmp: 10, turbFreq: 1.4, squash: 0.3, glow: 0.2,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_water_crest', name: 'Wave Crest', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.42,
          opacity: track([[0.03, 0], [0.1, 0.95], [0.28, 0.9], [0.4, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: crest.id, p: {} }, size: 210,
            x: track([[0.03, 74], [0.16, 6], [0.4, -44]]),
            y: FEET - 28,
            scale: track([[0.03, 0.85], [0.16, 1.05], [0.4, 1.1]]),
            aspect: 1, rot: 0, color: [255, 255, 255], squash: 0.45, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_water_foam', name: 'Foam Collar', type: 'sprite', blend: 'screen',
          start: -0.02, end: 0.42,
          opacity: track([[0.03, 0], [0.09, 0.8], [0.36, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'ring', p: { th: 0.22 } }, size: 180, x: 0, y: FEET,
            scale: track([[0.03, 0.35], [0.36, 2.0]]),
            aspect: 1, rot: 0, color: [230, 246, 255], squash: 1, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_water_trough', name: 'Dark Trough', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.42,
          opacity: track([[0.04, 0], [0.12, 0.45], [0.34, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 170, x: 0, y: FEET + 8,
            scale: track([[0.04, 0.6], [0.34, 1.9]]),
            aspect: 1, rot: 0, color: [16, 62, 126], squash: 1, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobWaterSurge, DOC_ID, import.meta.url)
