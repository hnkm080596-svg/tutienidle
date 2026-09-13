// Pack the PixelLab mortal combat clips into the project's trimmed atlas format.
//
// Usage:
//   node scripts/pack-mortal-combat-art.mjs <pixel-lab-frame-dir>
//
// PixelLab emits 256x256 frames. The combat catalogue keeps the authored box
// at 128x128, so this packer downsamples with nearest-neighbour sampling and
// writes the same JSON Hash shape consumed by Phaser's load.atlas().
import { createCanvas, loadImage } from 'canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const inputArg = process.argv[2]
const INPUT_DIR = path.resolve(inputArg ?? '')
const OUT_DIR = path.resolve(process.argv[3] ?? 'public/assets/characters/player/mortal')

const SOURCE_WIDTH = 128
const SOURCE_HEIGHT = 128
const PADDING = 2
const COLUMNS = 10
const FRAME_PREFIX = 'frame_'
const FRAME_SUFFIX = '.png'
const ZERO_PAD = 3

const groups = [
  { name: 'idle', count: 32 },
  // ready and standby intentionally share this guard sequence. The runtime
  // has two lifecycle names, but the mortal art has one stable neutral guard.
  { name: 'guard', count: 11, sourceName: 'idle' },
  { name: 'cast', count: 16 },
  { name: 'sweep', count: 16 },
  { name: 'punch', count: 16 },
  { name: 'death', count: 16 },
]

if (!inputArg) {
  throw new Error('A PixelLab frame directory is required')
}

function framePath(name, index) {
  return path.join(INPUT_DIR, `${name}-${String(index).padStart(3, '0')}.png`)
}

function frameName(index) {
  return `${FRAME_PREFIX}${String(index).padStart(ZERO_PAD, '0')}${FRAME_SUFFIX}`
}

function opaqueBounds(context) {
  const { data } = context.getImageData(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)
  let minX = SOURCE_WIDTH
  let minY = SOURCE_HEIGHT
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < SOURCE_HEIGHT; y++) {
    for (let x = 0; x < SOURCE_WIDTH; x++) {
      if (data[(y * SOURCE_WIDTH + x) * 4 + 3] === 0) {
        continue
      }

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX < 0) {
    throw new Error('PixelLab frame is fully transparent')
  }

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function removeSweepEffectPixels(context) {
  const image = context.getImageData(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)

  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset]
    const green = image.data[offset + 1]
    const blue = image.data[offset + 2]

    // PixelLab occasionally adds a bright red slash mark to a hand-chop
    // gesture. Remove only saturated red effect pixels; the character's skin
    // and robe highlights are less saturated and remain untouched.
    if (red >= 115 && green <= 135 && blue <= 105 && red - green >= 40 && red - blue >= 40) {
      image.data[offset + 3] = 0
    }
  }

  context.putImageData(image, 0, 0)
}

async function loadSource(name, index, cache) {
  const file = framePath(name, index)

  if (!cache.has(file)) {
    cache.set(file, await loadImage(file))
  }

  const source = cache.get(file)
  const canvas = createCanvas(SOURCE_WIDTH, SOURCE_HEIGHT)
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)
  context.drawImage(source, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)

  if (name === 'sweep') {
    removeSweepEffectPixels(context)
  }

  return { canvas, context, bounds: opaqueBounds(context) }
}

async function main() {
  const cache = new Map()
  const rendered = []

  for (const group of groups) {
    const sourceName = group.sourceName ?? group.name

    for (let index = 1; index <= group.count; index++) {
      rendered.push({
        source: await loadSource(sourceName, index, cache),
      })
    }
  }

  const cellWidth = Math.max(...rendered.map((entry) => entry.source.bounds.w)) + PADDING * 2
  const cellHeight = Math.max(...rendered.map((entry) => entry.source.bounds.h)) + PADDING * 2
  const rows = Math.ceil(rendered.length / COLUMNS)
  const sheet = createCanvas(cellWidth * COLUMNS, cellHeight * rows)
  const sheetContext = sheet.getContext('2d')
  const frames = {}

  rendered.forEach((entry, index) => {
    const { bounds, canvas } = entry.source
    const x = (index % COLUMNS) * cellWidth + PADDING
    const y = Math.floor(index / COLUMNS) * cellHeight + PADDING

    sheetContext.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, x, y, bounds.w, bounds.h)

    frames[frameName(index)] = {
      frame: { x, y, w: bounds.w, h: bounds.h },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { ...bounds },
      sourceSize: { w: SOURCE_WIDTH, h: SOURCE_HEIGHT },
    }
  })

  mkdirSync(OUT_DIR, { recursive: true })
  const pngName = 'player-mortal-combat-atlas-v2.png'
  const jsonName = 'player-mortal-combat-atlas-v2.json'
  writeFileSync(path.join(OUT_DIR, pngName), sheet.toBuffer('image/png'))
  writeFileSync(
    path.join(OUT_DIR, jsonName),
    `${JSON.stringify(
      {
        frames,
        meta: {
          app: 'pack-mortal-combat-art.mjs',
          version: '2.0',
          image: pngName,
          format: 'RGBA8888',
          size: { w: sheet.width, h: sheet.height },
          scale: '1',
        },
      },
      null,
      2,
    )}\n`,
  )

  console.log(
    `Mortal atlas written to ${OUT_DIR}/${pngName} + ${jsonName} ` +
      `(${sheet.width}x${sheet.height}, ${rendered.length} frames)`,
  )
}

await main()
