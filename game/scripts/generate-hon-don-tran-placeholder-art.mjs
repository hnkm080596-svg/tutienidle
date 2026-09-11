// Placeholder combat animation — 32 frames, emitted as a TEXTUREPACKER ATLAS.
//
// Spec B §3.4 (docs/superpowers/specs/2026-09-11-combat-animation-metadata-design.md).
//
// Shared by every combat entity (player/enemy/companion, real battles
// included). Each frame is a stylised figure plus a large frame number, so one
// glance says whether the AnimationManager is actually running or stuck — the
// same class of bug as the 2026-09-05 tick-loop freeze, but in animation.
//
// WHY AN ATLAS, when the art is a placeholder (2026-09-11):
//
// §3.1 makes a trimmed TexturePacker atlas the standard character format. If the
// placeholder stayed a grid spritesheet, that format would ship with zero
// consumers, and the first REAL atlas would simultaneously be the first test of
// the loader path, the metadata shape, the frame naming and the trim maths —
// with no way to tell which half was wrong. So the placeholder is packed the way
// real art will be.
//
// The trim is REAL, not identity: frames are drawn on transparency and each
// one's tight bounds are measured, so `spriteSourceSize` differs per frame and
// anything consuming it is exercised before real art exists. The figure is
// deliberately drawn at a slightly different size and offset each frame to make
// that so.
//
// Output format is JSON Hash (TexturePacker's "Phaser 3" export), matching
// scripts/build-ink-wash-assets.mjs and loaded with `load.atlas`. When real art
// arrives, drop a TexturePacker export in its place — same two files, same frame
// names — and nothing in src/ changes.
import { createCanvas } from 'canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/** The untrimmed box every frame is authored in. Reported as `sourceSize`. */
const FRAME_WIDTH = 200
const FRAME_HEIGHT = 350
const FRAME_COUNT = 32

/** Transparent gap between packed frames, so neighbours cannot bleed in. */
const PADDING = 2

/** Frames per row in the packed sheet. Keeps the texture near-square. */
const COLUMNS = 8

const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public/assets/characters/placeholder',
)

const PNG_NAME = 'combat-anim-32frame.png'
const JSON_NAME = 'combat-anim-32frame.json'

/** `frame_000.png` … — TexturePacker's default naming at zero-pad 3. */
const FRAME_PREFIX = 'frame_'
const FRAME_SUFFIX = '.png'
const ZERO_PAD = 3

function frameName(index) {
  return `${FRAME_PREFIX}${String(index).padStart(ZERO_PAD, '0')}${FRAME_SUFFIX}`
}

/**
 * Draw one frame onto a transparent canvas of the untrimmed box.
 *
 * The figure's size and vertical offset drift across the sequence on purpose:
 * identical bounds on every frame would make the trim data uniform, and uniform
 * trim data cannot catch a consumer that ignores it.
 */
function drawFrame(context, index) {
  const phase = index / FRAME_COUNT

  // Hue rotates with the frame — a second visual signal, so a running animation
  // is recognisable even when the number is moving too fast to read. It is on
  // the FIGURE now, not on a background rectangle: an opaque background would
  // make every frame's trim the full box, which is the thing this file exists
  // to avoid.
  const hue = Math.round(phase * 360)

  // Breathing scale and bob, purely so the trimmed bounds differ per frame.
  const scale = 0.88 + 0.12 * Math.sin(phase * Math.PI * 2)
  const bob = Math.sin(phase * Math.PI * 4) * FRAME_HEIGHT * 0.02

  const headRadius = FRAME_WIDTH * 0.16 * scale
  const headY = FRAME_HEIGHT * 0.18 + bob

  const bodyW = FRAME_WIDTH * 0.44 * scale
  const bodyH = FRAME_HEIGHT * 0.56 * scale
  const bodyX = (FRAME_WIDTH - bodyW) / 2
  const bodyY = FRAME_HEIGHT * 0.32 + bob

  context.fillStyle = `hsl(${hue}, 55%, 45%)`

  context.beginPath()
  context.arc(FRAME_WIDTH / 2, headY, headRadius, 0, Math.PI * 2)
  context.fill()

  context.beginPath()
  context.roundRect(bodyX, bodyY, bodyW, bodyH, FRAME_WIDTH * 0.08)
  context.fill()

  // The frame number — the primary signal that animation is advancing.
  context.fillStyle = '#111111'
  context.font = `bold ${Math.round(FRAME_HEIGHT * 0.22)}px sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(String(index), FRAME_WIDTH / 2, bodyY + bodyH / 2)
}

/** Tight bounds of the non-transparent pixels. This is what "trimmed" means. */
function opaqueBounds(context) {
  const { data } = context.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT)

  let minX = FRAME_WIDTH
  let minY = FRAME_HEIGHT
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH; x++) {
      if (data[(y * FRAME_WIDTH + x) * 4 + 3] === 0) {
        continue
      }

      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0) {
    // A fully transparent frame would make w/h zero and Phaser unhappy. Not
    // reachable with the current drawing, but cheap to refuse explicitly.
    throw new Error('placeholder frame drew nothing')
  }

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

// 1. Render every frame once, on its own transparent canvas, and measure it.
const rendered = []

for (let index = 0; index < FRAME_COUNT; index++) {
  const frameCanvas = createCanvas(FRAME_WIDTH, FRAME_HEIGHT)
  const frameContext = frameCanvas.getContext('2d')

  drawFrame(frameContext, index)

  rendered.push({ index, canvas: frameCanvas, bounds: opaqueBounds(frameContext) })
}

// 2. Pack the TRIMMED frames into a grid. Cells are sized by the largest frame,
//    which keeps the packer trivial while the atlas stays honest: each frame's
//    `frame` rect is its own trimmed size, not the cell.
const cellWidth = Math.max(...rendered.map((entry) => entry.bounds.w)) + PADDING * 2
const cellHeight = Math.max(...rendered.map((entry) => entry.bounds.h)) + PADDING * 2
const rows = Math.ceil(FRAME_COUNT / COLUMNS)

const sheet = createCanvas(cellWidth * COLUMNS, cellHeight * rows)
const sheetContext = sheet.getContext('2d')

const frames = {}

for (const entry of rendered) {
  const column = entry.index % COLUMNS
  const row = Math.floor(entry.index / COLUMNS)

  const x = column * cellWidth + PADDING
  const y = row * cellHeight + PADDING

  sheetContext.drawImage(
    entry.canvas,
    entry.bounds.x,
    entry.bounds.y,
    entry.bounds.w,
    entry.bounds.h,
    x,
    y,
    entry.bounds.w,
    entry.bounds.h,
  )

  frames[frameName(entry.index)] = {
    frame: { x, y, w: entry.bounds.w, h: entry.bounds.h },
    rotated: false,
    trimmed: true,
    // Where the trimmed pixels sit inside the untrimmed box. This is the value
    // an anchor has to be corrected by, and it differs per frame here on
    // purpose.
    spriteSourceSize: {
      x: entry.bounds.x,
      y: entry.bounds.y,
      w: entry.bounds.w,
      h: entry.bounds.h,
    },
    sourceSize: { w: FRAME_WIDTH, h: FRAME_HEIGHT },
  }
}

mkdirSync(OUT_DIR, { recursive: true })

writeFileSync(path.join(OUT_DIR, PNG_NAME), sheet.toBuffer('image/png'))

writeFileSync(
  path.join(OUT_DIR, JSON_NAME),
  `${JSON.stringify(
    {
      frames,
      meta: {
        app: 'generate-hon-don-tran-placeholder-art.mjs',
        version: '2.0',
        image: PNG_NAME,
        format: 'RGBA8888',
        size: { w: sheet.width, h: sheet.height },
        scale: '1',
      },
    },
    null,
    2,
  )}\n`,
)

const trimmedWidths = new Set(rendered.map((entry) => entry.bounds.w))

console.log(
  `Placeholder atlas written to ${OUT_DIR}/${PNG_NAME} + ${JSON_NAME} ` +
    `(${sheet.width}x${sheet.height}, ${FRAME_COUNT} frames, ` +
    `${trimmedWidths.size} distinct trimmed widths)`,
)
