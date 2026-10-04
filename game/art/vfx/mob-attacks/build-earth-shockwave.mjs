import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_earth_shockwave'

// One jagged fault line crossing the comp with branches and rubble chips; the
// sprite layer squashes it into the ground plane at runtime.
const CRACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <g fill="none" stroke="#241207" stroke-width="8" stroke-linecap="round" stroke-linejoin="miter">
    <path d="M30 142 L72 126 L98 138 L128 120 L162 134 L198 122 L228 132"/>
    <path d="M60 106 L98 100 L134 108"/>
    <path d="M142 154 L174 148 L202 156"/>
    <path d="M128 120 L134 94 L146 74"/>
    <path d="M128 120 L118 150 L110 172"/>
    <path d="M162 134 L176 156 L184 176"/>
    <path d="M98 138 L86 164 L80 186"/>
  </g>
  <g fill="none" stroke="#7a4f26" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="miter">
    <path d="M30 142 L72 126 L98 138 L128 120 L162 134 L198 122 L228 132"/>
    <path d="M60 106 L98 100 L134 108"/>
    <path d="M142 154 L174 148 L202 156"/>
    <path d="M128 120 L134 94 L146 74"/>
    <path d="M128 120 L118 150 L110 172"/>
    <path d="M162 134 L176 156 L184 176"/>
    <path d="M98 138 L86 164 L80 186"/>
  </g>
  <g fill="#241207">
    <path d="M118 128 L134 122 L142 134 L126 140 Z"/>
    <path d="M78 122 L90 116 L96 126 L84 132 Z"/>
    <path d="M172 128 L184 122 L190 132 L178 138 Z"/>
  </g>
</svg>`

// Hot variant of the same faults - light strokes only, used by the additive
// ember layer (dark texels add no light under 'add' blend).
const CRACK_HOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <g fill="none" stroke="#ff9d3e" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.55">
    <path d="M30 142 L72 126 L98 138 L128 120 L162 134 L198 122 L228 132"/>
    <path d="M60 106 L98 100 L134 108"/>
    <path d="M142 154 L174 148 L202 156"/>
    <path d="M128 120 L134 94 L146 74"/>
    <path d="M128 120 L118 150 L110 172"/>
    <path d="M162 134 L176 156 L184 176"/>
    <path d="M98 138 L86 164 L80 186"/>
  </g>
  <g fill="none" stroke="#ffd9a0" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 142 L72 126 L98 138 L128 120 L162 134 L198 122 L228 132"/>
    <path d="M60 106 L98 100 L134 108"/>
    <path d="M142 154 L174 148 L202 156"/>
    <path d="M128 120 L134 94 L146 74"/>
    <path d="M128 120 L118 150 L110 172"/>
    <path d="M162 134 L176 156 L184 176"/>
    <path d="M98 138 L86 164 L80 186"/>
  </g>
</svg>`

const crack = texture('mob_earth_crack', CRACK_SVG)
const crackHot = texture('mob_earth_crack_hot', CRACK_HOT_SVG)
const TEXTURES = [crack, crackHot]

// Ground line for a grounded binding is comp y ~= +0.35*h; with h=192 the feet
// anchor sits at ~+64 px under comp centre.
const FEET = 58

export function buildMobEarthShockwave() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Earth Shockwave',
      comp: { w: 256, h: 192, dur: 0.42, fps: 30 },
      cam: { comp: 32 },
      exp: { cols: 5, rows: 3, frames: 13, cellW: 256, cellH: 192, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        {
          id: 'lr_earth_rocks', name: 'Thrown Rocks', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.42,
          em: {
            x: 0, y: FEET - 4, shape: 'point', sx: 10, sy: 6, dir: 'dir', angle: -90, spread: 72,
            speed: 210, speedRnd: 0.45, rate: 0, bursts: [{ t: 0.02, n: 13 }], seed: 23,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.55, lifeRnd: 0.3, sprite: { kind: 'shape', id: 'shard', p: {} }, size: 11, sizeRnd: 0.45,
            sizeOL: curve([0, 1], [0.8, 0.9], [1, 0.3]),
            opacityOL: curve([0, 1], [0.75, 1], [1, 0]),
            grad: grad([0, [156, 112, 66]], [0.6, [110, 76, 44]], [1, [70, 46, 28]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 160, spinRnd: 0.8, alignVel: false, stretch: 0,
            gravX: 0, gravY: 400, drag: 0.4, turbAmp: 10, turbFreq: 1.5, squash: 0, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_earth_ring_glow', name: 'Shock Ring', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.42,
          opacity: track([[0.01, 0], [0.05, 0.85], [0.3, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'ring', p: { th: 0.14 } }, size: 200, x: 0, y: FEET,
            scale: track([[0.01, 0.22], [0.3, 2.3]]),
            aspect: 1, rot: 0, color: [255, 196, 110], squash: 1, glow: 0.3, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_earth_dust', name: 'Dust Roll', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.42,
          em: {
            x: 0, y: FEET, shape: 'ring', sx: 14, sy: 5, dir: 'out', angle: -90, spread: 30,
            speed: 150, speedRnd: 0.3, rate: 0, bursts: [{ t: 0.02, n: 14 }, { t: 0.07, n: 8 }], seed: 31,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.5, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'smoke', p: {} }, size: 24, sizeRnd: 0.4,
            sizeOL: curve([0, 0.5], [0.45, 1], [1, 1.3]),
            opacityOL: curve([0, 0], [0.2, 0.8], [1, 0]),
            grad: grad([0, [214, 178, 126]], [0.55, [164, 126, 82]], [1, [110, 82, 56]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 60, spinRnd: 1, alignVel: false, stretch: 0,
            gravX: 0, gravY: -16, drag: 2.2, turbAmp: 14, turbFreq: 1.2, squash: 0.4, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          // Ember copy of the fault lines - drawn ABOVE the dark crack so the
          // additive pass lights the seams and the rift still reads on dark
          // ground at 64 px combat scale (layers index 0 = top).
          id: 'lr_earth_crack_ember', name: 'Ember Fissures', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.42,
          opacity: track([[0.02, 0], [0.1, 0.85], [0.28, 0.7], [0.42, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: crackHot.id, p: {} }, size: 220, x: 0, y: FEET + 6,
            scale: track([[0.02, 0.55], [0.1, 1]]),
            aspect: 1, rot: 0, color: [255, 190, 120], squash: 1, glow: 0.4, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_earth_crack', name: 'Fissure Fan', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.42,
          opacity: track([[0.02, 0], [0.09, 0.95], [0.3, 0.9], [0.42, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: crack.id, p: {} }, size: 220, x: 0, y: FEET + 6,
            scale: track([[0.02, 0.55], [0.1, 1]]),
            aspect: 1, rot: 0, color: [255, 255, 255], squash: 1, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_earth_glow', name: 'Impact Glow', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.42,
          opacity: track([[0.01, 0], [0.05, 0.7], [0.22, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 130, x: 0, y: FEET - 8,
            scale: track([[0.01, 0.4], [0.22, 1.5]]),
            aspect: 1, rot: 0, color: [255, 210, 130], squash: 0, glow: 0.4, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobEarthShockwave, DOC_ID, import.meta.url)
