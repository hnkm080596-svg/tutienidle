import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_bite'

// Upper gum band: shallow downward-bowing arc with five fangs hanging from it.
// The two centre fangs are longest so the snapped silhouette still reads as a
// jaw at ~120 px combat size.
const UPPER_JAW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <path d="M46 74 Q128 44 210 74 L202 102 Q128 76 54 102 Z" fill="#a12a38" stroke="#2c0a16" stroke-width="9" stroke-linejoin="round"/>
  <g fill="#ffffff" stroke="#2c0a16" stroke-width="8" stroke-linejoin="round">
    <path d="M66 96 L80 130 L94 94 Z"/>
    <path d="M96 90 L113 140 L130 88 Z"/>
    <path d="M126 88 L142 142 L158 90 Z"/>
    <path d="M158 92 L172 134 L188 96 Z"/>
    <path d="M192 96 L202 124 L214 92 Z" fill="#e2ecf8"/>
  </g>
</svg>`

// Lower jaw mirrors the upper one. The second and fourth fangs are oversized so
// they visibly interlock between the upper teeth when the jaws meet.
const LOWER_JAW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <path d="M50 182 Q128 212 206 182 L198 154 Q128 180 58 154 Z" fill="#a12a38" stroke="#2c0a16" stroke-width="9" stroke-linejoin="round"/>
  <g fill="#ffffff" stroke="#2c0a16" stroke-width="8" stroke-linejoin="round">
    <path d="M62 160 L76 126 L90 162 Z"/>
    <path d="M94 166 L110 114 L126 168 Z"/>
    <path d="M128 168 L142 120 L158 166 Z"/>
    <path d="M160 164 L176 116 L190 160 Z"/>
    <path d="M190 158 L200 132 L212 164 Z" fill="#e2ecf8"/>
  </g>
</svg>`

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
