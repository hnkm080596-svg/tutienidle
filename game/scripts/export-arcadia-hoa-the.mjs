// Render the editable Arcadia source with Arcadia's own engine, not a painted sheet.
// Usage: node scripts/export-arcadia-hoa-the.mjs "E:/tutienidle-tools/arcadia-effects/Arcada Effects"
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createCanvas, Image } from 'canvas'

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arcadiaRoot = path.resolve(process.argv[2] ?? 'E:/tutienidle-tools/arcadia-effects/Arcada Effects')
const sourcePath = path.join(gameRoot, 'art/vfx/hoa-cau-thuat/Hoa The.json')
const outputDir = path.join(gameRoot, 'public/assets/vfx/hoa-cau-thuat/fire-stroke')

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
if (effect.app !== 'arcadia-effects' || effect.doc.id !== 'fx_hoa_the') {
  throw new Error('Unexpected Arcadia source document')
}
const doc = await new Promise(resolve => globalThis.AFX.Model.loadEffectFile(effect, resolve))
if (!doc || globalThis.AFX.Sprites.texs.size !== doc.textures.length) {
  throw new Error('Hoa The stroke textures did not all load')
}
if (doc.exp.mode !== 'rgba' || doc.comp.dur !== 2.4 || doc.exp.frames !== 36) {
  throw new Error('Hoa The export contract changed')
}
const { canvas, info } = globalThis.AFX.Atlas.build(doc)
const frames = {}
for (let index = 0; index < info.frames; index += 1) {
  const frame = {
    x: (index % info.cols) * info.frameWidth,
    y: Math.floor(index / info.cols) * info.frameHeight,
    w: info.frameWidth,
    h: info.frameHeight,
  }
  frames[`frame_${index}`] = {
    frame,
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: frame.w, h: frame.h },
    sourceSize: { w: frame.w, h: frame.h },
  }
}
const metadata = {
  frames,
  meta: {
    app: 'arcadia-effects',
    image: 'hoa-the.png',
    size: { w: canvas.width, h: canvas.height },
    scale: '1',
    durationMs: 2400,
    strokeLitMs: [150, 450, 750, 1050],
    burnStartMs: 1150,
    frameRate: info.fps,
    frameCount: info.frames,
    transparent: true,
  },
}
mkdirSync(outputDir, { recursive: true })
writeFileSync(path.join(outputDir, 'hoa-the.png'), canvas.toBuffer('image/png'))
writeFileSync(path.join(outputDir, 'hoa-the.json'), `${JSON.stringify(metadata, null, 2)}\n`)
console.log(`Arcadia RGBA atlas: ${canvas.width}x${canvas.height}, ${info.frames} frames, ${info.duration}s`)
