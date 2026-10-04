import { curve, grad, texMeta, texPayloads, texture, track, writeOnRun } from './mob-common.mjs'
import { SLASH_BLADE_SVG } from './mob-parts.mjs'

const DOC_ID = 'fx_mob_slash_vertical'

const blade = texture('mob_slashv_blade', SLASH_BLADE_SVG)
const TEXTURES = [blade]

// One downward sword cut: the blade crescent sweeps top->down through the
// target while arcing 62deg->118deg, sparks fly off the cut line, and a
// faint afterglow mark lingers a beat.
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
            x: track([[0.06, -12], [0.13, 10]]), y: track([[0.06, -20], [0.13, 22]]),
            shape: 'ring', sx: 10, sy: 14, dir: 'dir', angle: 100, spread: 60,
            speed: 270, speedRnd: 0.5, rate: 0,
            bursts: [{ t: 0.07, n: 8 }, { t: 0.12, n: 6 }], seed: 61,
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
          id: 'lr_sv_blade_glow', name: 'Blade Edge', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.36,
          opacity: track([[0.02, 0], [0.05, 0.9], [0.17, 0.85], [0.25, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: blade.id, p: {} }, size: 196, x: -4,
            y: track([[0.02, -42], [0.12, -4], [0.19, 32]]),
            rot: track([[0.02, 62], [0.1, 92], [0.17, 118]]),
            scale: 1.1,
            aspect: 1, color: [255, 190, 150], squash: 0, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_sv_blade', name: 'Blade Cut', type: 'sprite', blend: 'normal',
          start: -0.02, end: 0.36,
          opacity: track([[0.02, 0], [0.05, 1], [0.17, 0.95], [0.24, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: blade.id, p: {} }, size: 185, x: -4,
            y: track([[0.02, -42], [0.12, -4], [0.19, 32]]),
            rot: track([[0.02, 62], [0.1, 92], [0.17, 118]]),
            scale: 1,
            aspect: 1, color: [255, 255, 255], squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_sv_afterglow', name: 'Cut Afterglow', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.36,
          opacity: track([[0.16, 0], [0.2, 0.4], [0.34, 0]]),
          sp: {
            sprite: { kind: 'tex', texId: blade.id, p: {} }, size: 185, x: 0, y: 8,
            rot: 96,
            scale: 0.98,
            aspect: 1, color: [255, 120, 90], squash: 0, glow: 0.3, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
        {
          id: 'lr_sv_flash', name: 'Contact Flash', type: 'sprite', blend: 'add',
          start: -0.02, end: 0.36,
          opacity: track([[0.07, 0], [0.1, 0.8], [0.2, 0]]),
          sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} }, size: 120, x: -2, y: 0,
            scale: track([[0.07, 0.4], [0.14, 1.4]]),
            aspect: 1, rot: 0, color: [255, 244, 230], squash: 0, glow: 0.5, glowSize: 1.6, glowBlur: 0.15, fps: 0,
          },
        },
      ],
    },
    tex: texPayloads(TEXTURES),
  }
}

writeOnRun(buildMobSlashVertical, DOC_ID, import.meta.url)
