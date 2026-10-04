// Export the mob-attack Arcadia sources with Arcadia's renderer.
// Usage: node scripts/export-arcadia-mob-attacks.mjs "<arcadia-clone>/Arcada Effects"
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createCanvas, Image } from 'canvas'

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arcadiaRoot = path.resolve(process.argv[2] ?? 'E:/tutienidle-tools/arcadia-effects/Arcada Effects')

const EFFECTS = [
  { file: 'Bite.json', id: 'fx_mob_bite', out: 'mob-bite', name: 'bite' },
  { file: 'Claw.json', id: 'fx_mob_claw', out: 'mob-claw', name: 'claw' },
  { file: 'Earth Shockwave.json', id: 'fx_mob_earth_shockwave', out: 'mob-earth-shockwave', name: 'earth-shockwave' },
  { file: 'Water Surge.json', id: 'fx_mob_water_surge', out: 'mob-water-surge', name: 'water-surge' },
  { file: 'Boss Ground Slam.json', id: 'fx_mob_boss_ground_slam', out: 'mob-boss-ground-slam', name: 'boss-ground-slam' },
]

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

for (const spec of EFFECTS) {
  const sourcePath = path.join(gameRoot, 'art/vfx/mob-attacks', spec.file)
  const outputDir = path.join(gameRoot, 'public/assets/vfx', spec.out)
  const effect = JSON.parse(readFileSync(sourcePath, 'utf8'))
  if (effect.app !== 'arcadia-effects' || effect.doc.id !== spec.id)
    throw new Error(`Unexpected Arcadia source document: ${spec.file}`)
  const doc = await new Promise(resolve => globalThis.AFX.Model.loadEffectFile(effect, resolve))
  // texs accumulates across loop iterations, so verify this doc's own ids
  // rather than comparing registry size.
  if (!doc || !doc.textures.every(tex => globalThis.AFX.Sprites.texs.has(tex.id)))
    throw new Error(`Arcadia textures did not all load: ${spec.file}`)
  if (doc.exp.mode !== 'rgba')
    throw new Error(`Mob attack export expects rgba atlas: ${spec.file}`)

  const { canvas, info } = globalThis.AFX.Atlas.build(doc)
  const frames = {}
  for (let index = 0; index < info.frames; index++) {
    const frame = {
      x: (index % info.cols) * info.frameWidth,
      y: Math.floor(index / info.cols) * info.frameHeight,
      w: info.frameWidth, h: info.frameHeight,
    }
    frames[`frame_${index}`] = {
      frame, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frame.w, h: frame.h },
      sourceSize: { w: frame.w, h: frame.h },
    }
  }
  const metadata = { frames, meta: {
    app: 'arcadia-effects', image: `${spec.name}.png`,
    size: { w: canvas.width, h: canvas.height }, scale: '1',
    durationMs: Math.round(doc.comp.dur * 1000), frameRate: info.fps, frameCount: info.frames,
    transparent: true,
  } }
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(path.join(outputDir, `${spec.name}.png`), canvas.toBuffer('image/png'))
  writeFileSync(path.join(outputDir, `${spec.name}.json`), `${JSON.stringify(metadata, null, 2)}\n`)
  console.log(`${spec.id}: ${canvas.width}x${canvas.height} RGBA atlas, ${info.frames} frames -> ${spec.out}`)
}
