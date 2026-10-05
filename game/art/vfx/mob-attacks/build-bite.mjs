import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_bite'

// Spectral maw, translucent standard: ghost-pale ivory fangs on a faint bone
// arc (no gum band, no solid silhouette). Fangs lean left - the direction the
// enemy bites toward (enemy right -> player at comp center).
const UPPER_JAW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <ellipse cx="152" cy="22" rx="120" ry="58" fill="#e8d6b4" fill-opacity="0.18"/>
  <path d="M46 82 Q128 58 210 82" fill="none" stroke="#dcc9a0" stroke-opacity="0.7" stroke-width="7" stroke-linecap="round"/>
  <path d="M196 62 Q226 54 244 42" fill="none" stroke="#dcc9a0" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round"/>
  <g fill="#f2e2bc" fill-opacity="0.8" stroke="#6e4f2c" stroke-opacity="0.85" stroke-width="5" stroke-linejoin="round">
    <path d="M52 84 L55 122 Q66 100 76 86 Z"/>
    <path d="M84 84 L87 140 Q99 104 110 86 Z"/>
    <path d="M116 84 L119 152 Q133 106 142 86 Z"/>
    <path d="M148 86 L151 138 Q162 104 172 86 Z"/>
    <path d="M180 86 L183 120 Q194 100 204 86 Z"/>
  </g>
</svg>`

const LOWER_JAW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <ellipse cx="152" cy="234" rx="120" ry="58" fill="#e8d6b4" fill-opacity="0.18"/>
  <path d="M46 174 Q128 198 210 174" fill="none" stroke="#dcc9a0" stroke-opacity="0.7" stroke-width="7" stroke-linecap="round"/>
  <path d="M196 194 Q226 202 244 214" fill="none" stroke="#dcc9a0" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round"/>
  <g fill="#f2e2bc" fill-opacity="0.8" stroke="#6e4f2c" stroke-opacity="0.85" stroke-width="5" stroke-linejoin="round">
    <path d="M52 172 L55 134 Q66 156 76 170 Z"/>
    <path d="M84 172 L87 116 Q99 152 110 170 Z"/>
    <path d="M116 172 L119 104 Q133 150 142 170 Z"/>
    <path d="M148 170 L151 118 Q162 152 172 170 Z"/>
    <path d="M180 170 L183 136 Q194 156 204 170 Z"/>
  </g>
</svg>`

const upper = texture('mob_bite_upper_spectral', UPPER_JAW_SVG)
const lower = texture('mob_bite_lower_spectral', LOWER_JAW_SVG)
const TEXTURES = [upper, lower]

// Snap lands at t=0.15s: jaws rush in, lock with a small rebound, then the
// whole set fades while a small white-amber flash marks the contact point.
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
          id: 'lr_bite_flash', name: 'Bite Flash', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.34,
          opacity: track([[0.13, 0], [0.155, 0.8], [0.27, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'spark', p: {} }, size: 96, x: 0, y: -4,
            scale: track([[0.13, 0.4], [0.17, 1.0], [0.27, 1.3]]),
            aspect: 1, rot: 0, color: [255, 240, 214], squash: 0, glow: 0.45, glowSize: 1.4, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_bite_bloom', name: 'Amber Bloom', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.34,
          opacity: track([[0.14, 0], [0.175, 0.55], [0.29, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 72, x: 0, y: -4,
            scale: track([[0.14, 0.6], [0.21, 1.4]]),
            aspect: 1, rot: 0, color: [255, 214, 160], squash: 0, glow: 0.3, glowSize: 1.5, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_bite_sparks', name: 'Fang Sparks', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.34,
          em: {
            x: 0, y: -4, shape: 'ring', sx: 8, sy: 8, dir: 'dir', angle: 180, spread: 65,
            speed: 220, speedRnd: 0.45, rate: 0, bursts: [{ t: 0.15, n: 11 }], seed: 7,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.3, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'streak', p: {} }, size: 9, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.6, 0.7], [1, 0.1]),
            opacityOL: curve([0, 1], [0.5, 0.85], [1, 0]),
            grad: grad([0, [255, 255, 255]], [0.5, [255, 226, 176]], [1, [222, 160, 92]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: true, stretch: 1.8,
            gravX: 0, gravY: 60, drag: 3, turbAmp: 8, turbFreq: 1.5, squash: 0, glow: 0.4,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_bite_drool', name: 'Drool Flecks', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.34,
          em: {
            x: 0, y: 2, shape: 'ring', sx: 12, sy: 6, dir: 'dir', angle: -90, spread: 60,
            speed: 120, speedRnd: 0.5, rate: 0, bursts: [{ t: 0.16, n: 4 }], seed: 17,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.42, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'dot', p: {} }, size: 6, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.5, 0.9], [1, 0.3]),
            opacityOL: curve([0, 1], [0.7, 0.8], [1, 0]),
            grad: grad([0, [255, 238, 202]], [1, [212, 168, 106]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: false, stretch: 1.2,
            gravX: 0, gravY: 300, drag: 0.4, turbAmp: 6, turbFreq: 1.5, squash: 0, glow: 0.2,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_bite_jaw_top', name: 'Upper Fangs', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.34,
          opacity: track([[0, 0], [0.035, 0.85], [0.26, 0.85], [0.335, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: upper.id, p: {} }, size: 246, x: 0, y: track(upperKeys),
            scale: track([[0.055, 1.06], [0.15, 1]]), aspect: 1, rot: 0, color: [255, 255, 255],
            squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_bite_jaw_bottom', name: 'Lower Fangs', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.34,
          opacity: track([[0, 0], [0.035, 0.85], [0.26, 0.85], [0.335, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: lower.id, p: {} }, size: 246, x: 0, y: track(lowerKeys),
            scale: track([[0.055, 1.06], [0.15, 1]]), aspect: 1, rot: 0, color: [255, 255, 255],
            squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_bite_mist', name: 'Spectral Mist', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.34,
          em: {
            x: 34, y: 0, shape: 'box', sx: 80, sy: 52, dir: 'dir', angle: 180, spread: 30,
            speed: 48, speedRnd: 0.5, rate: 16, bursts: [], seed: 23,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 1.0, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'smoke', p: {} }, size: 34, sizeRnd: 0.45,
            sizeOL: curve([0, 0.6], [0.5, 1], [1, 1.3]),
            opacityOL: curve([0, 0], [0.25, 0.36], [1, 0]),
            grad: grad([0, [246, 224, 172]], [0.6, [232, 198, 134]], [1, [208, 168, 104]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 24, spinRnd: 0.6, alignVel: false, stretch: 0,
            gravX: 0, gravY: -10, drag: 0.8, turbAmp: 16, turbFreq: 1.1, squash: 0.3, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobBite, DOC_ID, import.meta.url)
