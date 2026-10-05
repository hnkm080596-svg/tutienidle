import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_boss_ground_slam'

// Boss-weight rift: wider jagged fault fan than the earth shockwave crack,
// a crater rim of lifted slabs, and a deeper dent so the slam reads heavier.
// Translucent so the ground reads through.
const CRACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <g fill="none" stroke="#180a03" stroke-linecap="round" stroke-linejoin="round" opacity="0.87">
    <path d="M128 142 L100 130 L72 142 L44 128 L16 140" stroke-width="19"/>
    <path d="M128 142 L160 128 L192 142 L220 128 L248 138" stroke-width="19"/>
    <path d="M128 142 L140 106 L126 76 L142 46" stroke-width="16"/>
    <path d="M128 142 L110 170 L116 198" stroke-width="15"/>
    <path d="M100 130 L92 160 L76 184" stroke-width="12"/>
    <path d="M160 128 L174 160 L170 188" stroke-width="12"/>
    <path d="M72 142 L60 110 L42 96" stroke-width="11"/>
    <path d="M192 142 L206 112 L226 98" stroke-width="11"/>
    <path d="M108 148 L84 168 L78 194" stroke-width="10"/>
    <path d="M152 148 L178 170 L186 196" stroke-width="10"/>
  </g>
  <ellipse cx="128" cy="146" rx="58" ry="24" fill="#100601" opacity="0.6"/>
  <g fill="#140a03" opacity="0.92">
    <path d="M94 116 L124 102 L134 120 L104 132 Z"/>
    <path d="M54 110 L80 100 L88 120 L62 128 Z"/>
    <path d="M174 110 L200 100 L210 120 L184 130 Z"/>
    <path d="M136 44 L158 32 L166 50 L144 60 Z"/>
    <path d="M120 150 L148 140 L156 158 L128 166 Z"/>
    <path d="M58 170 L80 162 L88 178 L66 186 Z"/>
    <path d="M180 172 L202 164 L210 180 L188 188 Z"/>
    <path d="M104 62 L120 52 L128 68 L112 76 Z"/>
    <path d="M22 128 L42 120 L48 134 L28 140 Z"/>
    <path d="M216 126 L236 118 L242 132 L222 138 Z"/>
  </g>
</svg>`

// Hot variant of the same faults - light strokes only for the additive ember
// pass (dark texels add no light under 'add' blend).
const CRACK_HOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <g fill="none" stroke="#ff7f22" stroke-linecap="round" stroke-linejoin="round" opacity="0.55">
    <path d="M128 142 L100 130 L72 142 L44 128 L16 140" stroke-width="12"/>
    <path d="M128 142 L160 128 L192 142 L220 128 L248 138" stroke-width="12"/>
    <path d="M128 142 L140 106 L126 76 L142 46" stroke-width="10"/>
    <path d="M128 142 L110 170 L116 198" stroke-width="9"/>
    <path d="M100 130 L92 160 L76 184" stroke-width="7"/>
    <path d="M160 128 L174 160 L170 188" stroke-width="7"/>
    <path d="M72 142 L60 110 L42 96" stroke-width="6"/>
    <path d="M192 142 L206 112 L226 98" stroke-width="6"/>
    <path d="M108 148 L84 168 L78 194" stroke-width="6"/>
    <path d="M152 148 L178 170 L186 196" stroke-width="6"/>
  </g>
  <g fill="none" stroke="#ffe1ac" stroke-linecap="round" stroke-linejoin="round">
    <path d="M128 142 L100 130 L72 142 L44 128 L16 140" stroke-width="5"/>
    <path d="M128 142 L160 128 L192 142 L220 128 L248 138" stroke-width="5"/>
    <path d="M128 142 L140 106 L126 76 L142 46" stroke-width="4.5"/>
    <path d="M128 142 L110 170 L116 198" stroke-width="4"/>
    <path d="M100 130 L92 160 L76 184" stroke-width="3"/>
    <path d="M160 128 L174 160 L170 188" stroke-width="3"/>
    <path d="M72 142 L60 110 L42 96" stroke-width="2.6"/>
    <path d="M192 142 L206 112 L226 98" stroke-width="2.6"/>
    <path d="M108 148 L84 168 L78 194" stroke-width="2.6"/>
    <path d="M152 148 L178 170 L186 196" stroke-width="2.6"/>
  </g>
</svg>`

const crack = texture('mob_slam_crack', CRACK_SVG)
const crackHot = texture('mob_slam_crack_hot', CRACK_HOT_SVG)
const TEXTURES = [crack, crackHot]

// Comp is taller than the other mob sheets (224 px) so the debris arc fits;
// the grounded feet anchor lands near +0.35*h.
const FEET = 74

export function buildMobBossGroundSlam() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Boss Ground Slam',
      comp: { w: 256, h: 224, dur: 0.44, fps: 30 },
      cam: { comp: 32 },
      exp: { cols: 5, rows: 3, frames: 13, cellW: 256, cellH: 224, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        {
          id: 'lr_slam_flash_white', name: 'Impact Flash', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.44,
          opacity: track([[0.01, 0], [0.045, 1], [0.2, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 170, x: 0, y: FEET - 10,
            scale: track([[0.01, 0.4], [0.2, 1.8]]),
            aspect: 1, rot: 0, color: [255, 244, 220], squash: 0, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_slam_dark', name: 'Screen Dim', type: 'sprite', blend: 'multiply',
          start: -0.02, end: 0.44,
          opacity: track([[0.02, 0], [0.07, 0.55], [0.2, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 480, x: 0, y: 0,
            scale: track([[0.02, 1], [0.2, 1.25]]),
            aspect: 1, rot: 0, color: [30, 34, 48], squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_slam_streaks', name: 'Slam Streaks', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.44,
          em: {
            x: 0, y: FEET - 6, shape: 'ring', sx: 14, sy: 6, dir: 'out', angle: -90, spread: 40,
            speed: 420, speedRnd: 0.4, rate: 0, bursts: [{ t: 0.02, n: 14 }], seed: 53,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.3, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'streak', p: {} }, size: 12, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.55, 0.7], [1, 0.05]),
            opacityOL: curve([0, 1], [0.5, 0.9], [1, 0]),
            grad: grad([0, [255, 244, 210]], [0.5, [255, 170, 80]], [1, [200, 90, 30]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: true, stretch: 2.2,
            gravX: 0, gravY: 120, drag: 2.8, turbAmp: 10, turbFreq: 1.5, squash: 0.6, glow: 0.5,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_slam_ring_fast', name: 'Shock Ring', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.44,
          opacity: track([[0.01, 0], [0.05, 0.9], [0.32, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'ring', p: { th: 0.16 } }, size: 210, x: 0, y: FEET,
            scale: track([[0.01, 0.18], [0.32, 2.6]]),
            aspect: 1, rot: 0, color: [255, 216, 140], squash: 1, glow: 0.3, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_slam_debris', name: 'Debris Chunks', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.44,
          em: {
            x: 0, y: FEET - 4, shape: 'ring', sx: 16, sy: 6, dir: 'dir', angle: -90, spread: 78,
            speed: 260, speedRnd: 0.5, rate: 0, bursts: [{ t: 0.02, n: 16 }], seed: 59,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.6, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'shard', p: {} }, size: 13, sizeRnd: 0.45,
            sizeOL: curve([0, 1], [0.8, 0.9], [1, 0.3]),
            opacityOL: curve([0, 1], [0.78, 1], [1, 0]),
            grad: grad([0, [170, 128, 80]], [0.6, [120, 86, 50]], [1, [70, 48, 30]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 200, spinRnd: 0.9, alignVel: false, stretch: 0,
            gravX: 0, gravY: 460, drag: 0.4, turbAmp: 12, turbFreq: 1.4, squash: 0, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_slam_dust', name: 'Dust Billow', type: 'emitter', blend: 'normal',
          start: -0.02, end: 0.44,
          em: {
            x: 0, y: FEET, shape: 'ring', sx: 18, sy: 6, dir: 'out', angle: -90, spread: 30,
            speed: 175, speedRnd: 0.35, rate: 0, bursts: [{ t: 0.02, n: 12 }, { t: 0.08, n: 8 }], seed: 61,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.55, lifeRnd: 0.35, sprite: { kind: 'shape', id: 'smoke', p: {} }, size: 30, sizeRnd: 0.4,
            sizeOL: curve([0, 0.5], [0.45, 1.05], [1, 1.4]),
            opacityOL: curve([0, 0], [0.2, 0.8], [1, 0]),
            grad: grad([0, [200, 164, 116]], [0.55, [150, 114, 76]], [1, [96, 72, 50]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 70, spinRnd: 1, alignVel: false, stretch: 0,
            gravX: 0, gravY: -14, drag: 2.2, turbAmp: 16, turbFreq: 1.2, squash: 0.4, glow: 0,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_slam_ring_outer', name: 'Dust Shock', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.44,
          opacity: track([[0.03, 0], [0.08, 0.5], [0.42, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'ring', p: { th: 0.24 } }, size: 230, x: 0, y: FEET,
            scale: track([[0.03, 0.3], [0.42, 2.4]]),
            aspect: 1, rot: 0, color: [150, 116, 76], squash: 1, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          // Additive ember pass drawn ABOVE the dark crack so the seams glow and
          // the rift still reads on dark ground at 64 px combat scale.
          id: 'lr_slam_crack_ember', name: 'Ember Fissures', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.44,
          opacity: track([[0.02, 0], [0.1, 0.9], [0.32, 0.75], [0.44, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: crackHot.id, p: {} }, size: 240, x: 0, y: FEET + 4,
            scale: track([[0.02, 0.5], [0.11, 1]]),
            aspect: 1, rot: 0, color: [255, 190, 120], squash: 1, glow: 0.4, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_slam_crack', name: 'Crater Fissures', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.44,
          opacity: track([[0.02, 0], [0.1, 0.95], [0.34, 0.9], [0.44, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: crack.id, p: {} }, size: 240, x: 0, y: FEET + 4,
            scale: track([[0.02, 0.5], [0.11, 1]]),
            aspect: 1, rot: 0, color: [255, 255, 255], squash: 1, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_slam_glow', name: 'Heat Core', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.44,
          opacity: track([[0.01, 0], [0.05, 0.75], [0.24, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 150, x: 0, y: FEET - 8,
            scale: track([[0.01, 0.4], [0.24, 1.6]]),
            aspect: 1, rot: 0, color: [255, 204, 120], squash: 0, glow: 0.4, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobBossGroundSlam, DOC_ID, import.meta.url)
