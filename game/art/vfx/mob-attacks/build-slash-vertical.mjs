import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'

const DOC_ID = 'fx_mob_slash_vertical'

// Spectral blade cut: a long tapered crescent that reads as a real slash —
// translucent crimson body bleeding through amber into a hot ivory spine,
// thin warm rim for readability. Pointed both ends; fill stays ~0.74 alpha
// so it reads as light, not a pasted solid. Same cut language as the claw
// gashes but one heavy stroke instead of three parallel ones.
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

const blade = texture('mob_slashv_blade', BLADE_SVG)
const TEXTURES = [blade]

// One heavy downward cut from the enemy side: the crescent drops top-right ->
// bottom-left through the target while arcing ~58->120 deg, strikes a small
// ground flash + spark burst at the low end, then a pale echo mark lingers.
export function buildMobSlashVertical() {
  return {
    app: 'arcadia-effects',
    v: 1,
    doc: {
      v: 1,
      id: DOC_ID,
      name: 'Mob Slash Vertical',
      comp: { w: 256, h: 192, dur: 0.36, fps: 30 },
      cam: { comp: 55 },
      exp: { cols: 4, rows: 3, frames: 11, cellW: 256, cellH: 192, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
      textures: texMeta(TEXTURES),
      layers: [
        {
          id: 'lr_sv_sparks', name: 'Cut Sparks', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.36,
          em: {
            x: track([[0.07, 8], [0.15, -10]]), y: track([[0.07, -4], [0.15, 30]]),
            shape: 'ring', sx: 10, sy: 14, dir: 'dir', angle: 115, spread: 55,
            speed: 280, speedRnd: 0.5, rate: 0,
            bursts: [{ t: 0.08, n: 7 }, { t: 0.13, n: 6 }], seed: 61,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.26, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'streak', p: {} }, size: 9, sizeRnd: 0.4,
            sizeOL: curve([0, 1], [0.55, 0.7], [1, 0.05]),
            opacityOL: curve([0, 1], [0.55, 0.95], [1, 0]),
            grad: grad([0, [255, 255, 245]], [0.5, [255, 160, 110]], [1, [200, 50, 40]]),
            tintTex: false, rot: 0, rotRnd: 0, spin: 0, spinRnd: 0, alignVel: true, stretch: 1.9,
            gravX: -30, gravY: 160, drag: 2.6, turbAmp: 8, turbFreq: 1.5, squash: 0, glow: 0.45,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_sv_embers', name: 'Impact Embers', type: 'emitter', blend: 'screen',
          start: -0.02, end: 0.36,
          em: {
            x: -12, y: 44, shape: 'ring', sx: 12, sy: 5, dir: 'dir', angle: -80, spread: 70,
            speed: 200, speedRnd: 0.5, rate: 0,
            bursts: [{ t: 0.15, n: 9 }], seed: 63,
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
          },
          pt: {
            life: 0.32, lifeRnd: 0.4, sprite: { kind: 'shape', id: 'ember', p: {} }, size: 9, sizeRnd: 0.45,
            sizeOL: curve([0, 1], [0.6, 0.7], [1, 0.1]),
            opacityOL: curve([0, 1], [0.5, 0.9], [1, 0]),
            grad: grad([0, [255, 250, 235]], [0.4, [255, 185, 105]], [1, [205, 65, 42]]),
            tintTex: false, rot: 0, rotRnd: 1, spin: 50, spinRnd: 0.6, alignVel: false, stretch: 0,
            gravX: -25, gravY: 170, drag: 2.2, turbAmp: 9, turbFreq: 1.5, squash: 0, glow: 0.5,
            glowSize: 1.6, glowBlur: 0.15, fps: 0, render: 'sprite', trailCore: 0, zigzag: 0,
          },
        },
        {
          id: 'lr_sv_impact', name: 'Low-End Burst', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.36,
          opacity: track([[0.145, 0], [0.165, 0.85], [0.27, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'star', p: { n: 6, inr: 0.28 } }, size: 88, x: -12, y: 46,
            scale: track([[0.145, 0.35], [0.2, 1.05], [0.28, 1.25]]), rot: 14,
            aspect: 1, color: [255, 238, 205], squash: 0.35, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_sv_blade_bloom', name: 'Blade Bloom', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.36,
          opacity: track([[0.02, 0], [0.05, 0.45], [0.17, 0.4], [0.25, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: blade.id, p: {} }, size: 202,
            x: track([[0.02, 18], [0.12, 2], [0.19, -14]]),
            y: track([[0.02, -48], [0.12, -4], [0.19, 38]]),
            rot: track([[0.02, 58], [0.1, 92], [0.17, 120]]),
            scale: 1.08,
            aspect: 1, color: [255, 210, 160], squash: 0, glow: 0.55, glowSize: 1.7, glowBlur: 0.2, fps: 0,
          },
        },
        {
          id: 'lr_sv_blade', name: 'Blade Cut', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.36,
          opacity: track([[0.02, 0], [0.05, 0.85], [0.17, 0.8], [0.24, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: blade.id, p: {} }, size: 192,
            x: track([[0.02, 18], [0.12, 2], [0.19, -14]]),
            y: track([[0.02, -48], [0.12, -4], [0.19, 38]]),
            rot: track([[0.02, 58], [0.1, 92], [0.17, 120]]),
            scale: 1,
            aspect: 1, color: [255, 255, 255], squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_sv_afterglow', name: 'Cut Afterglow', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.36,
          opacity: track([[0.16, 0], [0.2, 0.35], [0.34, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: blade.id, p: {} }, size: 190, x: -8, y: 26,
            rot: 112,
            scale: 0.98,
            aspect: 1, color: [255, 150, 105], squash: 0, glow: 0.35, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobSlashVertical, DOC_ID, import.meta.url)
