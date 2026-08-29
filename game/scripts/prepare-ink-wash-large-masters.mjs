import fs from 'node:fs/promises'
import path from 'node:path'
import { createCanvas, loadImage } from 'canvas'

const projectRoot = path.resolve(import.meta.dirname, '..')
const rawRoot = path.join(projectRoot, 'art-source', 'ui', 'ink-wash', 'raw')
const approvedRoot = path.join(projectRoot, 'art-source', 'ui', 'ink-wash', 'approved')

async function render(sourceName, outputName, width, height, transform) {
  const source = await loadImage(path.join(rawRoot, sourceName))
  const canvas = createCanvas(width ?? source.width, height ?? source.height)
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  transform?.(context, canvas)
  await fs.writeFile(path.join(approvedRoot, outputName), canvas.toBuffer('image/png'))
}

function clearFrameCenter(slice) {
  return (context, canvas) => {
    context.clearRect(slice, slice, canvas.width - slice * 2, canvas.height - slice * 2)
  }
}

function extractDarkInk(slice = 0) {
  return (context, canvas) => {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    for (let index = 0; index < pixels.data.length; index += 4) {
      const luminance = Math.round(
        pixels.data[index] * 0.2126
        + pixels.data[index + 1] * 0.7152
        + pixels.data[index + 2] * 0.0722,
      )
      const alpha = Math.max(0, Math.min(255, (245 - luminance) * 12))
      pixels.data[index] = luminance
      pixels.data[index + 1] = luminance
      pixels.data[index + 2] = luminance
      pixels.data[index + 3] = alpha
    }
    context.putImageData(pixels, 0, 0)
    if (slice > 0) {
      context.clearRect(slice, slice, canvas.width - slice * 2, canvas.height - slice * 2)
    }
  }
}

async function prepareLeftMountain() {
  const [rightMountain, rejectedLeft] = await Promise.all([
    loadImage(path.join(rawRoot, 'wash-corner-mountain-right.png')),
    loadImage(path.join(rawRoot, 'wash-corner-mountain-left.png')),
  ])
  const canvas = createCanvas(rightMountain.width, rightMountain.height)
  const context = canvas.getContext('2d')

  // The accepted right mountain has genuine alpha. Mirror it to establish a
  // clean left wash, then deepen it slightly so the right remains more distant.
  context.save()
  context.translate(canvas.width, 0)
  context.scale(-1, 1)
  context.drawImage(rightMountain, 0, 0)
  context.restore()
  const base = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < base.data.length; index += 4) {
    base.data[index] = Math.round(base.data[index] * 0.84)
    base.data[index + 1] = Math.round(base.data[index + 1] * 0.84)
    base.data[index + 2] = Math.round(base.data[index + 2] * 0.84)
    base.data[index + 3] = Math.min(255, Math.round(base.data[index + 3] * 1.22))
  }
  context.putImageData(base, 0, 0)

  // Recover only the carbon-dark pine/foreground silhouette from the rejected
  // preview. Its baked checker is too bright to survive this ink-only mask.
  const pineCanvas = createCanvas(canvas.width, canvas.height)
  const pineContext = pineCanvas.getContext('2d')
  pineContext.drawImage(rejectedLeft, 0, 0, canvas.width, canvas.height)
  const pine = pineContext.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < pine.data.length; index += 4) {
    const luminance = Math.round(
      pine.data[index] * 0.2126
      + pine.data[index + 1] * 0.7152
      + pine.data[index + 2] * 0.0722,
    )
    pine.data[index] = luminance
    pine.data[index + 1] = luminance
    pine.data[index + 2] = luminance
    pine.data[index + 3] = Math.max(0, Math.min(220, (132 - luminance) * 3))
  }
  pineContext.putImageData(pine, 0, 0)
  context.drawImage(pineCanvas, 0, 0)

  await fs.writeFile(
    path.join(approvedRoot, 'wash-corner-mountain-left.png'),
    canvas.toBuffer('image/png'),
  )
}

await fs.mkdir(approvedRoot, { recursive: true })

await Promise.all([
  render('surface-m-paper.png', 'surface-m-paper@4x.png', 768, 768),
  render(
    'frame-m-seal-corner.png',
    'frame-m-seal-corner@4x.png',
    768,
    768,
    clearFrameCenter(128),
  ),
  render('surface-l-ink-data.png', 'surface-l-ink-data@4x.png', 1280, 1280),
  render(
    'frame-l-landscape-safe.png',
    'frame-l-landscape@4x.png',
    1280,
    1280,
    extractDarkInk(192),
  ),
  render('surface-xl-paper-scroll.png', 'surface-xl-paper-scroll@4x.png', 2048, 2048),
  render(
    'frame-xl-ceremony-safe-v2.png',
    'frame-xl-ceremony@4x.png',
    2048,
    2048,
    extractDarkInk(320),
  ),
  prepareLeftMountain(),
  render('wash-corner-mountain-right.png', 'wash-corner-mountain-right.png'),
  render('wash-bottom-mist.png', 'wash-bottom-mist.png'),
  render('wash-bamboo-right.png', 'wash-bamboo-right.png'),
  render('seal-cinnabar-small.png', 'seal-cinnabar-small.png'),
  render('seal-cinnabar-large.png', 'seal-cinnabar-large.png'),
])

console.log('Prepared M/L/XL masters and six painting overlays.')
