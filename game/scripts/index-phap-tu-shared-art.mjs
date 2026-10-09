// Index the user-supplied 732x756 transparent cell sheets as Phaser atlases.
// The PNGs remain untouched; rerun this after pack-character-art.mjs, whose
// full rebuild regenerates manifest.json from its own NEWSPRITE sources.
import { createCanvas, loadImage } from 'canvas'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SLUG = 'phap_tu_shared'
const CELL = { w: 732, h: 756 }
const ROOT = path.resolve('public/assets/characters/animated')
const DIR = path.join(ROOT, SLUG)
const CHECK = process.argv.includes('--check')
const SHEETS = [
  { name: 'idle', count: 33, columns: 6, index: 1 },
  { name: 'attack', count: 17, columns: 5, index: 2 },
  { name: 'cast-special', count: 17, columns: 5, index: 3 },
  { name: 'death', count: 17, columns: 5, index: 4 },
]
// Authored impact frames (clip-local) - same lookup CharacterArt.impactMarker
// performs at runtime, so the manifest stays in parity with the JSON.
const IMPACT_MARKERS = JSON.parse(
  readFileSync(path.resolve('art/animation-impact-markers.json'), 'utf8'),
).characters?.[SLUG] ?? {}

function emitJson(file, data) {
  const desired = `${JSON.stringify(data, null, 2)}\n`
  if (CHECK) {
    // EOL-insensitive: Windows checkouts land CRLF in the worktree while the
    // emitted JSON is LF - compare normalized bytes or --check always cries
    // stale on a clean checkout.
    if (readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== desired) throw new Error(`Stale art index: ${file}`)
  } else {
    writeFileSync(file, desired)
  }
}

function clipEntry(sheet) {
  const entry = {
    framePrefix: `${SLUG}-${sheet.name}-`,
    firstFrame: 1,
    lastFrame: sheet.count,
    frameCount: sheet.count,
    sheet: `${SLUG}-sheet-${sheet.index}.png`,
    atlas: `${SLUG}-sheet-${sheet.index}.atlas.json`,
  }
  if (IMPACT_MARKERS[sheet.name] !== undefined) {
    entry.impactFrameIndex = IMPACT_MARKERS[sheet.name]
  }
  return entry
}

async function main() {
  const avatar = await loadImage(path.join(DIR, 'avatar.png'))
  if (avatar.width !== CELL.w || avatar.height !== CELL.h) {
    throw new Error(`Avatar must be ${CELL.w}x${CELL.h}`)
  }

  for (const sheet of SHEETS) {
    const imageName = `${SLUG}-sheet-${sheet.index}.png`
    const image = await loadImage(path.join(DIR, imageName))
    const expectedRows = Math.ceil(sheet.count / sheet.columns)
    if (image.width !== sheet.columns * CELL.w || image.height !== expectedRows * CELL.h) {
      throw new Error(`${imageName}: unexpected grid size ${image.width}x${image.height}`)
    }

    const canvas = createCanvas(image.width, image.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)
    if (sheet.name === 'idle') {
      // The displayed still is the transparent idle frame 001 - same crop as
      // avatar.png (both derived from the first idle cell).
      const avatarCanvas = createCanvas(CELL.w, CELL.h)
      avatarCanvas.getContext('2d').drawImage(image, 0, 0, CELL.w, CELL.h, 0, 0, CELL.w, CELL.h)
      const avatarPath = path.join(DIR, 'avatar-transparent.png')
      const desired = avatarCanvas.toBuffer('image/png')
      if (CHECK) {
        if (!readFileSync(avatarPath).equals(desired)) throw new Error(`Stale art image: ${avatarPath}`)
      } else {
        writeFileSync(avatarPath, desired)
      }
    }
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data
    const frames = {}
    // Union alpha bbox over the occupied cells (cell-local coords) - the
    // manifest extent, measured here so --check cannot drift from the art.
    let union = null
    for (let slot = 0; slot < expectedRows * sheet.columns; slot++) {
      const x = (slot % sheet.columns) * CELL.w
      const y = Math.floor(slot / sheet.columns) * CELL.h
      let minX = CELL.w, minY = CELL.h, maxX = -1, maxY = -1
      for (let cy = 0; cy < CELL.h; cy++) {
        for (let cx = 0; cx < CELL.w; cx++) {
          if (pixels[((y + cy) * image.width + x + cx) * 4 + 3] === 0) continue
          if (cx < minX) minX = cx
          if (cy < minY) minY = cy
          if (cx > maxX) maxX = cx
          if (cy > maxY) maxY = cy
        }
      }
      const occupied = maxX >= 0
      if (occupied !== (slot < sheet.count)) throw new Error(`${imageName}: unexpected filled cell ${slot + 1}`)
      if (!occupied) continue
      union = union === null
        ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
        : {
            x: Math.min(union.x, minX),
            y: Math.min(union.y, minY),
            w: Math.max(union.x + union.w, maxX + 1) - Math.min(union.x, minX),
            h: Math.max(union.y + union.h, maxY + 1) - Math.min(union.y, minY),
          }

      const frameName = `${SLUG}-${sheet.name}-${String(slot + 1).padStart(3, '0')}.png`
      frames[frameName] = {
        frame: { x, y, w: CELL.w, h: CELL.h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: CELL.w, h: CELL.h },
        sourceSize: { ...CELL },
      }
    }
    if (sheet.name === 'idle') {
      sheet.extent = {
        x: union.x / CELL.w, y: union.y / CELL.h, w: union.w / CELL.w, h: union.h / CELL.h,
      }
      process.stdout.write(
        `idle extent { x: ${sheet.extent.x.toFixed(6)}, y: ${sheet.extent.y.toFixed(6)}, ` +
          `w: ${sheet.extent.w.toFixed(6)}, h: ${sheet.extent.h.toFixed(6)} } ` +
          `(px ${union.x},${union.y} ${union.w}x${union.h} of ${CELL.w}x${CELL.h})\n`,
      )
    }
    emitJson(path.join(DIR, `${SLUG}-sheet-${sheet.index}.atlas.json`), {
      frames,
      meta: {
        app: 'index-phap-tu-shared-art.mjs', version: '1.0', image: imageName,
        format: 'RGBA8888', size: { w: image.width, h: image.height }, scale: '1',
      },
    })
  }

  const manifestPath = path.join(ROOT, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.variants[SLUG] = {
    out: SLUG,
    src: 'user-supplied-cell-sheets',
    pivot: { x: 0.5, y: 1 },
    extent: SHEETS[0].extent,
    sourceSize: { ...CELL },
    canvasSize: { ...CELL },
    sheets: 4,
    clips: {
      idle: clipEntry(SHEETS[0]),
      attack: clipEntry(SHEETS[1]),
      death: clipEntry(SHEETS[3]),
    },
    cast: { special: clipEntry(SHEETS[2]) },
    avatar: 'idle-first-frame (transparent crop of idle cell 001)',
    avatarSize: { ...CELL },
    avatars: {}, portraits: {}, closeups: {}, radars: {},
  }
  emitJson(manifestPath, manifest)
  process.stdout.write(`${CHECK ? 'Verified' : 'Indexed'} ${SLUG}: 33 idle, 17 attack, 17 special, 17 death frames\n`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
