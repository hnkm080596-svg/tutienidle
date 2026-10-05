// Export the editable Arcadia Tam Muoi source with Arcadia's renderer.
// Usage: node scripts/export-arcadia-tam-muoi-aura.mjs "E:/tutienidle-tools/arcadia-effects/Arcada Effects"
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createCanvas, Image } from 'canvas'

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arcadiaRoot = path.resolve(process.argv[2] ?? 'E:/tutienidle-tools/arcadia-effects/Arcada Effects')
const sourcePath = path.join(gameRoot, 'art/vfx/hoa-cau-thuat/Tam Muoi Fire Aura.json')
const outputDir = path.join(gameRoot, 'public/assets/vfx/hoa-cau-thuat/tam-muoi-aura')

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
if (effect.app !== 'arcadia-effects' || effect.doc.id !== 'fx_tam_muoi_fire_aura')
  throw new Error('Unexpected Arcadia source document')
const doc = await new Promise(resolve => globalThis.AFX.Model.loadEffectFile(effect, resolve))
if (!doc || globalThis.AFX.Sprites.texs.size !== doc.textures.length)
  throw new Error('Arcadia aura textures did not all load')
if (doc.exp.mode !== 'rgba' || doc.comp.dur !== 1.2 || doc.exp.frames !== 36)
  throw new Error('Tam Muoi aura export contract changed')
mkdirSync(outputDir, { recursive: true })
for (const pass of ['back', 'front']) {
  const passLayers = doc.layers.filter(layer => layer.name.startsWith(`${pass.toUpperCase()}:`))
  if (!passLayers.length) throw new Error(`Arcadia aura has no ${pass} layers`)
  const { canvas, info } = globalThis.AFX.Atlas.build({ ...doc, layers: passLayers })
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
  const filename = `tam-muoi-aura-${pass}`
  const metadata = { frames, meta: {
    app: 'arcadia-effects', image: `${filename}.png`,
    size: { w: canvas.width, h: canvas.height }, scale: '1',
    durationMs: 1200, frameRate: info.fps, frameCount: info.frames,
    transparent: true, loop: true, pass,
  } }
  writeFileSync(path.join(outputDir, `${filename}.png`), canvas.toBuffer('image/png'))
  writeFileSync(path.join(outputDir, `${filename}.json`), `${JSON.stringify(metadata, null, 2)}\n`)
  console.log(`Arcadia Tam Muoi ${pass} RGBA atlas: ${canvas.width}x${canvas.height}, ${info.frames} frames`)
}
