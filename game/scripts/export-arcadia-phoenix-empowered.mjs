// Export the empowered (azure) projectile with Arcadia's own renderer.
// Usage: node scripts/export-arcadia-phoenix-empowered.mjs "E:/tutienidle-tools/arcadia-effects/Arcada Effects"
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createCanvas, Image } from 'canvas'

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arcadiaRoot = path.resolve(process.argv[2] ?? 'E:/tutienidle-tools/arcadia-effects/Arcada Effects')
const sourcePath = path.join(gameRoot, 'art/vfx/hoa-cau-thuat/Hoa Cau Phoenix Empowered.json')
const outputDir = path.join(gameRoot, 'public/assets/vfx/hoa-cau-thuat/projectile-empowered')

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
if (effect.app !== 'arcadia-effects' || effect.doc.id !== 'fx_hoa_cau_phoenix_empowered') {
  throw new Error('Unexpected Arcadia empowered projectile source')
}
const doc = globalThis.AFX.Model.migrate(effect.doc)
if (doc.comp.dur !== 1.2 || doc.exp.frames !== 36 || doc.exp.mode !== 'rgba') {
  throw new Error('Empowered projectile export contract changed')
}
const { canvas, info } = globalThis.AFX.Atlas.build(doc)
// Same loop handoff as the red comet: blend the last six seeded-emitter
// frames back to the first so repeated flight never jumps.
const context = canvas.getContext('2d')
const firstImage = context.getImageData(0, 0, info.frameWidth, info.frameHeight)
const first = firstImage.data
context.putImageData(firstImage, 0, 0)
for (let step = 0; step < 6; step += 1) {
  const index = info.frames - 6 + step
  const x = (index % info.cols) * info.frameWidth
  const y = Math.floor(index / info.cols) * info.frameHeight
  if (step === 5) {
    context.putImageData(firstImage, x, y)
    continue
  }
  const image = context.getImageData(x, y, info.frameWidth, info.frameHeight)
  const weight = (step + 1) / 6
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const oldAlpha = image.data[offset + 3] / 255
    const firstAlpha = first[offset + 3] / 255
    const alpha = oldAlpha * (1 - weight) + firstAlpha * weight
    for (let channel = 0; channel < 3; channel += 1) {
      const color = image.data[offset + channel] * oldAlpha * (1 - weight)
        + first[offset + channel] * firstAlpha * weight
      image.data[offset + channel] = alpha ? Math.round(color / alpha) : 0
    }
    image.data[offset + 3] = Math.round(alpha * 255)
  }
  context.putImageData(image, x, y)
}
const frames = {}
for (let index = 0; index < info.frames; index += 1) {
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
const metadata = {
  frames,
  meta: { app: 'arcadia-effects', image: 'hoa-cau-phoenix-empowered.png',
    size: { w: canvas.width, h: canvas.height }, scale: '1',
    durationMs: 1200, frameRate: info.fps, frameCount: info.frames,
    transparent: true, direction: 'right', includesAttachedTail: true, loopable: true },
}
mkdirSync(outputDir, { recursive: true })
writeFileSync(path.join(outputDir, 'hoa-cau-phoenix-empowered.png'), canvas.toBuffer('image/png'))
writeFileSync(path.join(outputDir, 'hoa-cau-phoenix-empowered.json'), `${JSON.stringify(metadata, null, 2)}\n`)
console.log(`Arcadia empowered Phoenix RGBA atlas: ${canvas.width}x${canvas.height}, ${info.frames} frames, ${info.duration}s`)
