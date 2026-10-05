import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Export tight control bounds without changing authored alpha or painted pixels.
const root = resolve('public/assets/ui/tien-hiep-2026-10')
const output = resolve(root, 'controls')
await mkdir(output, { recursive: true })
const source = resolve(root, 'source/shared-item-slot-v1.png')
await sharp(source).trim().png().toFile(resolve(output, 'item-slot-v1.png'))
const metadata = await sharp(resolve(output, 'item-slot-v1.png')).metadata()
const stats = await sharp(resolve(output, 'item-slot-v1.png')).stats()
if (!metadata.hasAlpha || stats.isOpaque || stats.channels[3].min !== 0) {
  throw new Error('Control exterior must retain authored transparency')
}
await writeFile(resolve(output, 'slot-manifest.json'), JSON.stringify({
  source: 'shared-item-slot-v1.png', width: metadata.width, height: metadata.height,
  alphaMin: stats.channels[3].min, alphaMax: stats.channels[3].max,
  opaque: stats.isOpaque, operation: 'tight crop only; authored alpha preserved',
}, null, 2) + '\n')
console.log('Exported one reusable transparent-edged slot')

const buttonSource = resolve(root, 'source/shared-buttons-atlas-v1.png')
const buttonMetadata = await sharp(buttonSource).metadata()
if (!buttonMetadata.width || !buttonMetadata.height || !buttonMetadata.hasAlpha) {
  throw new Error('Button atlas must be an RGBA image')
}
const half = Math.floor(buttonMetadata.height / 2)
const buttons = []
for (const [index, variant] of ['secondary', 'primary'].entries()) {
  const path = resolve(output, `button-${variant}-v1.png`)
  const cell = await sharp(buttonSource).extract({
    left: 0, top: index * half, width: buttonMetadata.width,
    height: index === 0 ? half : buttonMetadata.height - half,
  }).png().toBuffer()
  await sharp(cell).trim().png().toFile(path)
  const meta = await sharp(path).metadata()
  const alpha = await sharp(path).stats()
  if (!meta.hasAlpha || alpha.isOpaque || alpha.channels[3].min !== 0) {
    throw new Error(`${variant} button lost transparent exterior`)
  }
  buttons.push({ variant, width: meta.width, height: meta.height,
    alphaMin: alpha.channels[3].min, alphaMax: alpha.channels[3].max,
    opaque: alpha.isOpaque })
}
await writeFile(resolve(output, 'button-manifest.json'), JSON.stringify({
  source: 'shared-buttons-atlas-v1.png', operation: 'split and tight crop only', buttons,
}, null, 2) + '\n')
console.log('Exported two reusable transparent-edged buttons')

const inspectorSource = resolve(root, 'source/shared-inspector-v1.png')
const inspectorPath = resolve(output, 'inspector-v1.png')
await sharp(inspectorSource).trim().png().toFile(inspectorPath)
const inspectorMetadata = await sharp(inspectorPath).metadata()
const inspectorStats = await sharp(inspectorPath).stats()
if (!inspectorMetadata.hasAlpha || inspectorStats.isOpaque || inspectorStats.channels[3].min !== 0) {
  throw new Error('Inspector must preserve transparent exterior')
}
await writeFile(resolve(output, 'inspector-manifest.json'), JSON.stringify({
  source: 'shared-inspector-v1.png', width: inspectorMetadata.width,
  height: inspectorMetadata.height, alphaMin: inspectorStats.channels[3].min,
  alphaMax: inspectorStats.channels[3].max, opaque: inspectorStats.isOpaque,
  operation: 'tight crop only; authored alpha preserved',
}, null, 2) + '\n')
console.log('Exported one reusable transparent-edged inspector')

await sharp(resolve(root, 'source/shared-landmark-v1.png')).trim().png().toFile(resolve(output, 'landmark-v1.png'))
const landmarkMetadata = await sharp(resolve(output, 'landmark-v1.png')).metadata()
const landmarkStats = await sharp(resolve(output, 'landmark-v1.png')).stats()
if (!landmarkMetadata.hasAlpha || landmarkStats.isOpaque || landmarkStats.channels[3].min !== 0) {
  throw new Error('Landmark must preserve transparent exterior')
}
await writeFile(resolve(output, 'landmark-manifest.json'), JSON.stringify({
  source: 'shared-landmark-v1.png', width: landmarkMetadata.width, height: landmarkMetadata.height,
  alphaMin: landmarkStats.channels[3].min, alphaMax: landmarkStats.channels[3].max,
  opaque: landmarkStats.isOpaque, operation: 'tight crop only',
}, null, 2) + '\n')
const resourcesSource = resolve(root, 'source/shared-resources-atlas-v1.png')
const resourceMetadata = await sharp(resourcesSource).metadata()
if (!resourceMetadata.width || !resourceMetadata.height || !resourceMetadata.hasAlpha || resourceMetadata.width % 4 !== 0) {
  throw new Error('Resource atlas must contain four equal RGBA cells')
}
const resources = []
for (const [index, name] of ['jade', 'coin', 'crystal', 'essence'].entries()) {
  const path = resolve(output, `resource-${name}-v1.png`)
  await sharp(resourcesSource).extract({ left: index * resourceMetadata.width / 4, top: 0,
    width: resourceMetadata.width / 4, height: resourceMetadata.height }).resize(256, 256, { fit: 'contain', background: '#00000000' }).png().toFile(path)
  const alpha = await sharp(path).stats()
  if (alpha.isOpaque || alpha.channels[3].min !== 0) throw new Error(`${name} must have transparent exterior`)
  resources.push({ name, width: 256, height: 256, alphaMin: alpha.channels[3].min, alphaMax: alpha.channels[3].max, opaque: alpha.isOpaque })
}
await writeFile(resolve(output, 'resource-manifest.json'), JSON.stringify({ source: 'shared-resources-atlas-v1.png', resources }, null, 2) + '\n')
console.log('Exported one landmark and four reusable resources')

const bodyPath = resolve(output, 'body-diagram-v1.png')
await sharp(resolve(root, 'source/shared-body-diagram-v1.png')).trim().png().toFile(bodyPath)
const bodyMetadata = await sharp(bodyPath).metadata()
const bodyStats = await sharp(bodyPath).stats()
if (!bodyMetadata.hasAlpha || bodyStats.isOpaque || bodyStats.channels[3].min !== 0) {
  throw new Error('Body diagram must preserve authored transparency')
}
await writeFile(resolve(output, 'body-diagram-manifest.json'), JSON.stringify({
  source: 'shared-body-diagram-v1.png', width: bodyMetadata.width, height: bodyMetadata.height,
  alphaMin: bodyStats.channels[3].min, alphaMax: bodyStats.channels[3].max,
  opaque: bodyStats.isOpaque, operation: 'tight crop only; approved schematic UI diagram',
}, null, 2) + '\n')
console.log('Exported reusable transparent body diagram')
