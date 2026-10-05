// Export the authored triple fire circle as THREE per-ring atlases so the
// runtime can reveal them by cast tier: inner ring (gan chu Hoa) for every
// cast, +middle for empowered, +outer only for ultimate.
// Usage: node scripts/export-arcadia-circle-rings.mjs "<arcadia-root>"
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createCanvas, Image } from 'canvas'

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arcadiaRoot = path.resolve(process.argv[2]
  ?? `${process.env.HOME}/arcadia-tools/arcadia-effects/Arcada Effects`)
const sourcePath = path.join(gameRoot, 'art/vfx/hoa-cau-thuat/Hoa Cau Triple Fire Circle.json')
const outputDir = path.join(gameRoot, 'public/assets/vfx/hoa-cau-thuat/circle')

globalThis.window = globalThis
globalThis.Image = Image
globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error(`Unexpected DOM element: ${tag}`)
    return createCanvas(1, 1)
  },
  querySelector() { return null },
}
for (const name of ['utils', 'track', 'curve', 'path', 'sprites', 'model', 'sim', 'engine', 'atlas']) {
  const file = path.join(arcadiaRoot, 'js/core', `${name}.js`)
  vm.runInThisContext(readFileSync(file, 'utf8'), { filename: file })
}

const effect = JSON.parse(readFileSync(sourcePath, 'utf8'))
if (effect.app !== 'arcadia-effects' || effect.doc?.id !== 'fx_hoa_cau_triple_fire_circle') {
  throw new Error('Unexpected Arcadia circle source')
}
const doc = await new Promise(resolve => globalThis.AFX.Model.loadEffectFile(effect, resolve))
if (!doc || globalThis.AFX.Sprites.texs.size !== doc.textures.length) {
  throw new Error('Arcadia circle textures did not all load')
}
if (doc.comp.dur !== 2.28 || doc.exp.frames !== 64 || doc.exp.mode !== 'rgba') {
  throw new Error('Circle export contract changed')
}

// The core seal (calligraphy + center fire + breathing ember) rides the inner
// ring so every tier keeps the fire character; ambient embers orbit the outer
// seal so they appear only at the ultimate tier.
const RING_SETS = {
  inner: layer => layer.id.startsWith('lr_hc_inner')
    || ['lr_hc_calligraphy', 'lr_hc_center_fire', 'lr_hc_center_ember'].includes(layer.id),
  middle: layer => layer.id.startsWith('lr_hc_middle'),
  outer: layer => layer.id.startsWith('lr_hc_outer') || layer.id === 'lr_hc_ambient_embers',
}

mkdirSync(outputDir, { recursive: true })
for (const [ring, keep] of Object.entries(RING_SETS)) {
  const layers = (doc.layers || []).filter(keep)
  if (layers.length === 0) throw new Error(`No layers matched ring ${ring}`)
  const subset = { ...doc, layers }
  const { canvas, info } = globalThis.AFX.Atlas.build(subset)
  const frames = {}
  for (let index = 0; index < info.frames; index++) {
    const frame = {
      x: index % info.cols * info.frameWidth,
      y: Math.floor(index / info.cols) * info.frameHeight,
      w: info.frameWidth, h: info.frameHeight,
    }
    frames[`frame_${index}`] = {
      frame, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frame.w, h: frame.h },
      sourceSize: { w: frame.w, h: frame.h },
    }
  }
  const metadata = {
    frames,
    meta: { app: 'arcadia-effects', image: `hoa-cau-fire-circle-${ring}.png`,
      size: { w: canvas.width, h: canvas.height }, scale: '1',
      durationMs: 2280, frameRate: info.fps, frameCount: info.frames, transparent: true },
  }
  writeFileSync(path.join(outputDir, `hoa-cau-fire-circle-${ring}.png`), canvas.toBuffer('image/png'))
  writeFileSync(path.join(outputDir, `hoa-cau-fire-circle-${ring}.json`), `${JSON.stringify(metadata, null, 2)}\n`)
  console.log(`${ring}: ${canvas.width}x${canvas.height}, ${info.frames} frames, ${layers.length} layers`)
}
