import fs from 'node:fs/promises'
import path from 'node:path'
import { createCanvas, loadImage } from 'canvas'

const projectRoot = path.resolve(import.meta.dirname, '..')
const rawRoot = path.join(projectRoot, 'art-source', 'ui', 'ink-wash', 'raw')
const approvedRoot = path.join(projectRoot, 'art-source', 'ui', 'ink-wash', 'approved')

const resizeJobs = [
  ['frame-xs-ink-line-alpha.png', 'frame-xs-ink-line@4x.png', 256, 256],
  ['button-s-paper-alpha.png', 'button-s-paper@4x.png', 768, 256],
  ['button-s-ink-alpha.png', 'button-s-ink@4x.png', 768, 256],
  ['frame-s-slot-alpha.png', 'frame-s-slot@4x.png', 384, 384],
]

async function resizeMaster([sourceName, outputName, width, height]) {
  const source = await loadImage(path.join(rawRoot, sourceName))
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  await fs.writeFile(path.join(approvedRoot, outputName), canvas.toBuffer('image/png'))
}

async function prepareNeutralSealMaster() {
  const source = await loadImage(path.join(rawRoot, 'button-s-seal.png'))
  const canvas = createCanvas(768, 256)
  const context = canvas.getContext('2d')

  // Crop away the generated preview margin, then use a geometric clip only for
  // the exterior corners. The paper center remains opaque and tint-safe.
  const crop = {
    x: Math.round(source.width * 0.041),
    y: Math.round(source.height * 0.166),
    width: Math.round(source.width * 0.918),
    height: Math.round(source.height * 0.604),
  }
  const radius = 22
  context.beginPath()
  context.roundRect(0, 0, canvas.width, canvas.height, radius)
  context.clip()
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < pixels.data.length; index += 4) {
    const luminance = Math.round(
      pixels.data[index] * 0.2126
      + pixels.data[index + 1] * 0.7152
      + pixels.data[index + 2] * 0.0722,
    )
    pixels.data[index] = luminance
    pixels.data[index + 1] = luminance
    pixels.data[index + 2] = luminance
  }
  context.putImageData(pixels, 0, 0)
  await fs.writeFile(
    path.join(approvedRoot, 'button-s-seal@4x.png'),
    canvas.toBuffer('image/png'),
  )
}

await fs.mkdir(approvedRoot, { recursive: true })
await Promise.all(resizeJobs.map(resizeMaster))
await prepareNeutralSealMaster()

console.log('Prepared five approved XS/S ink-wash masters.')
