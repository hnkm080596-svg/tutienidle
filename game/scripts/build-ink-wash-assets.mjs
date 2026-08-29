import { createCanvas, loadImage } from 'canvas'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validateAssetDefinitions,
  validateRasterFacts,
} from '../src/assets/inkWashAssetValidation.ts'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const GAME_ROOT = resolve(SCRIPT_DIR, '..')
const MANIFEST_PATH = resolve(GAME_ROOT, 'src/assets/ink-wash-ui-slices.json')
const ART_ROOT = resolve(GAME_ROOT, 'art-source/ui/ink-wash/approved')
const RUNTIME_ROOT = resolve(GAME_ROOT, 'public/assets/ui/ink-wash')
const SLICE_ROOT = resolve(RUNTIME_ROOT, 'slices')
const OVERLAY_ROOT = resolve(RUNTIME_ROOT, 'overlays')
const ATLAS_ROOT = resolve(RUNTIME_ROOT, 'atlas')
const REVIEW_ROOT = resolve(RUNTIME_ROOT, 'review')
const CHECK_ONLY = process.argv.includes('--check')
const MASTER_SCALE = 4
const ATLAS_PADDING = 2
const ATLAS_WIDTH = 2048

const OVERLAY_IDS = [
  'wash-corner-mountain-left',
  'wash-corner-mountain-right',
  'wash-bottom-mist',
  'wash-bamboo-right',
  'seal-cinnabar-small',
  'seal-cinnabar-large',
]

async function readManifest() {
  return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
}

async function imageOrNull(path) {
  try {
    return await loadImage(path)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    if (String(error).includes('No such file or directory')) {
      return null
    }
    throw error
  }
}

function maxCenterAlpha(context, asset, scale) {
  if (asset.center !== 'transparent') return 255
  const x = asset.slices.left * scale
  const y = asset.slices.top * scale
  const width = (asset.sourceWidth - asset.slices.left - asset.slices.right) * scale
  const height = (asset.sourceHeight - asset.slices.top - asset.slices.bottom) * scale
  if (width <= 0 || height <= 0) return 0
  const pixels = context.getImageData(x, y, width, height).data
  let max = 0
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > max) max = pixels[index]
  }
  return max
}

async function writeScaled(image, width, height, path) {
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, canvas.toBuffer('image/png'))
}

function drawNineSlice(context, image, asset, x, y, width, height) {
  const { left, right, top, bottom } = asset.slices
  const sourceXs = [0, left, asset.sourceWidth - right]
  const sourceYs = [0, top, asset.sourceHeight - bottom]
  const sourceWidths = [left, asset.sourceWidth - left - right, right]
  const sourceHeights = [top, asset.sourceHeight - top - bottom, bottom]
  const targetXs = [x, x + left, x + width - right]
  const targetYs = [y, y + top, y + height - bottom]
  const targetWidths = [left, Math.max(0, width - left - right), right]
  const targetHeights = [top, Math.max(0, height - top - bottom), bottom]

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      if (targetWidths[column] <= 0 || targetHeights[row] <= 0) continue
      context.drawImage(
        image,
        sourceXs[column], sourceYs[row], sourceWidths[column], sourceHeights[row],
        targetXs[column], targetYs[row], targetWidths[column], targetHeights[row],
      )
    }
  }
}

function packFrames(entries) {
  const placements = []
  let x = ATLAS_PADDING
  let y = ATLAS_PADDING
  let rowHeight = 0

  for (const entry of entries) {
    if (x + entry.asset.sourceWidth + ATLAS_PADDING > ATLAS_WIDTH) {
      x = ATLAS_PADDING
      y += rowHeight + ATLAS_PADDING * 2
      rowHeight = 0
    }
    placements.push({ ...entry, x, y })
    x += entry.asset.sourceWidth + ATLAS_PADDING * 2
    rowHeight = Math.max(rowHeight, entry.asset.sourceHeight)
  }

  return {
    placements,
    height: Math.max(1, y + rowHeight + ATLAS_PADDING),
  }
}

function drawExtruded(context, image, x, y, width, height) {
  context.drawImage(image, x, y, width, height)
  for (let offset = 1; offset <= ATLAS_PADDING; offset += 1) {
    context.drawImage(image, 0, 0, width, 1, x, y - offset, width, 1)
    context.drawImage(image, 0, height - 1, width, 1, x, y + height - 1 + offset, width, 1)
    context.drawImage(image, 0, 0, 1, height, x - offset, y, 1, height)
    context.drawImage(image, width - 1, 0, 1, height, x + width - 1 + offset, y, 1, height)
  }
}

async function writeAtlas(entries) {
  const { placements, height } = packFrames(entries)
  const canvas = createCanvas(ATLAS_WIDTH, height)
  const context = canvas.getContext('2d')
  const frames = {}

  for (const placement of placements) {
    const { asset, image, x, y } = placement
    drawExtruded(context, image, x, y, asset.sourceWidth, asset.sourceHeight)
    frames[asset.id] = {
      frame: { x, y, w: asset.sourceWidth, h: asset.sourceHeight },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: asset.sourceWidth, h: asset.sourceHeight },
      sourceSize: { w: asset.sourceWidth, h: asset.sourceHeight },
    }
  }

  await mkdir(ATLAS_ROOT, { recursive: true })
  await writeFile(resolve(ATLAS_ROOT, 'ink-wash-ui.png'), canvas.toBuffer('image/png'))
  await writeFile(resolve(ATLAS_ROOT, 'ink-wash-ui.json'), JSON.stringify({
    frames,
    meta: {
      app: 'build-ink-wash-assets.mjs',
      version: '1.0',
      image: 'ink-wash-ui.png',
      format: 'RGBA8888',
      size: { w: ATLAS_WIDTH, h: height },
      scale: '1',
    },
  }, null, 2))
}

async function writeContactSheet(entries) {
  const cellWidth = 420
  const cellHeight = 250
  const canvas = createCanvas(cellWidth * 2, cellHeight * Math.ceil(entries.length / 2))
  const context = canvas.getContext('2d')
  context.fillStyle = '#f5f0e4'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#211f1a'
  context.font = '16px serif'

  entries.forEach(({ asset, image }, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = column * cellWidth + 16
    const y = row * cellHeight + 16
    context.fillText(asset.id, x, y + 16)
    const sampleWidth = Math.min(380, Math.max(asset.minimumWidth, asset.sourceWidth * 1.5))
    const sampleHeight = Math.min(180, Math.max(asset.minimumHeight, asset.sourceHeight * 0.7))
    drawNineSlice(context, image, asset, x, y + 36, sampleWidth, sampleHeight)
  })

  await mkdir(REVIEW_ROOT, { recursive: true })
  await writeFile(
    resolve(REVIEW_ROOT, 'ink-wash-ui-size-matrix.png'),
    canvas.toBuffer('image/png'),
  )
}

async function verifyRuntimeOutputs(manifest) {
  const errors = []
  for (const asset of manifest.assets) {
    for (const scale of [1, 2]) {
      const output = resolve(SLICE_ROOT, `${asset.id}@${scale}x.png`)
      const image = await imageOrNull(output)
      if (!image) {
        errors.push(`missing runtime asset: ${asset.id}@${scale}x.png`)
        continue
      }
      if (image.width !== asset.sourceWidth * scale || image.height !== asset.sourceHeight * scale) {
        errors.push(`${asset.id}@${scale}x: invalid runtime dimensions`)
      }
    }
  }

  for (const overlayId of OVERLAY_IDS) {
    if (!await imageOrNull(resolve(OVERLAY_ROOT, `${overlayId}.png`))) {
      errors.push(`missing runtime overlay: ${overlayId}.png`)
    }
  }

  for (const path of [
    resolve(ATLAS_ROOT, 'ink-wash-ui.png'),
    resolve(ATLAS_ROOT, 'ink-wash-ui.json'),
    resolve(RUNTIME_ROOT, 'ink-wash-ui-slices.json'),
    resolve(REVIEW_ROOT, 'ink-wash-ui-size-matrix.png'),
  ]) {
    try {
      await readFile(path)
    } catch {
      errors.push(`missing generated output: ${path.slice(GAME_ROOT.length + 1)}`)
    }
  }
  return errors
}

async function main() {
  const manifest = await readManifest()
  const definitionErrors = validateAssetDefinitions(manifest.assets.map((asset) => ({
    id: asset.id,
    width: asset.sourceWidth,
    height: asset.sourceHeight,
    left: asset.slices.left,
    right: asset.slices.right,
    top: asset.slices.top,
    bottom: asset.slices.bottom,
  })))

  if (definitionErrors.length > 0) {
    throw new Error(definitionErrors.join('\n'))
  }

  if (CHECK_ONLY) {
    const errors = await verifyRuntimeOutputs(manifest)
    if (errors.length > 0) {
      console.error(errors.join('\n'))
      process.exitCode = 1
      return
    }
    console.log(`ink-wash UI assets verified: ${manifest.assets.length} slices, ${OVERLAY_IDS.length} overlays`)
    return
  }

  const errors = []
  const runtimeEntries = []
  for (const asset of manifest.assets) {
    const masterPath = resolve(ART_ROOT, `${asset.id}@4x.png`)
    const master = await imageOrNull(masterPath)
    if (!master) {
      errors.push(`missing approved master: ${asset.id}@4x.png`)
      continue
    }

    const masterCanvas = createCanvas(master.width, master.height)
    const masterContext = masterCanvas.getContext('2d')
    masterContext.drawImage(master, 0, 0)
    const rasterErrors = validateRasterFacts(
      {
        id: asset.id,
        sourceWidth: asset.sourceWidth * MASTER_SCALE,
        sourceHeight: asset.sourceHeight * MASTER_SCALE,
        center: asset.center,
      },
      {
        width: master.width,
        height: master.height,
        centerAlpha: maxCenterAlpha(masterContext, asset, MASTER_SCALE),
      },
    )
    errors.push(...rasterErrors)
    if (rasterErrors.length > 0) continue

    const output1x = resolve(SLICE_ROOT, `${asset.id}@1x.png`)
    const output2x = resolve(SLICE_ROOT, `${asset.id}@2x.png`)
    await writeScaled(master, asset.sourceWidth, asset.sourceHeight, output1x)
    await writeScaled(master, asset.sourceWidth * 2, asset.sourceHeight * 2, output2x)
    const image = await loadImage(output1x)
    runtimeEntries.push({ asset, image })
  }

  await mkdir(RUNTIME_ROOT, { recursive: true })
  await copyFile(MANIFEST_PATH, resolve(RUNTIME_ROOT, 'ink-wash-ui-slices.json'))

  await mkdir(OVERLAY_ROOT, { recursive: true })
  for (const overlayId of OVERLAY_IDS) {
    const source = resolve(ART_ROOT, `${overlayId}.png`)
    if (!await imageOrNull(source)) {
      errors.push(`missing approved overlay: ${overlayId}.png`)
      continue
    }
    await copyFile(source, resolve(OVERLAY_ROOT, `${overlayId}.png`))
  }

  if (runtimeEntries.length > 0) {
    await writeContactSheet(runtimeEntries)
  }
  if (runtimeEntries.length === manifest.assets.length) {
    await writeAtlas(runtimeEntries)
  }

  if (errors.length > 0) {
    console.error(errors.join('\n'))
    process.exitCode = 1
    return
  }

  console.log(`ink-wash UI assets built: ${runtimeEntries.length} slices, ${OVERLAY_IDS.length} overlays`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
