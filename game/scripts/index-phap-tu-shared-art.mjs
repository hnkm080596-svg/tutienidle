// Index the user-supplied 244x252 transparent cell sheets as Phaser atlases.
// The PNGs remain untouched; rerun this after pack-character-art.mjs, whose
// full rebuild regenerates manifest.json from its own NEWSPRITE sources.
import { createCanvas, loadImage } from 'canvas'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SLUG = 'phap_tu_shared'
const CELL = { w: 244, h: 252 }
const ROOT = path.resolve('public/assets/characters/animated')
const DIR = path.join(ROOT, SLUG)
const CHECK = process.argv.includes('--check')
const SHEETS = [
  { name: 'idle', count: 33, columns: 6, index: 1 },
  { name: 'attack', count: 17, columns: 5, index: 2 },
  { name: 'cast-special', count: 17, columns: 5, index: 3 },
  { name: 'death', count: 17, columns: 5, index: 4 },
]

function emitJson(file, data) {
  const desired = `${JSON.stringify(data, null, 2)}\n`
  if (CHECK) {
    if (readFileSync(file, 'utf8') !== desired) throw new Error(`Stale art index: ${file}`)
  } else {
    writeFileSync(file, desired)
  }
}

function clipEntry(sheet) {
  return {
    framePrefix: `${SLUG}-${sheet.name}-`,
    firstFrame: 1,
    lastFrame: sheet.count,
    frameCount: sheet.count,
    sheet: `${SLUG}-sheet-${sheet.index}.png`,
    atlas: `${SLUG}-sheet-${sheet.index}.atlas.json`,
  }
}

async function main() {
  const avatar = await loadImage(path.join(DIR, 'avatar.png'))
  if (avatar.width !== CELL.w || avatar.height !== CELL.h) throw new Error('Avatar must be 244x252')

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
      // The standalone supplied still has an opaque black background. Keep it
      // as reference and derive the displayed still from transparent idle #1.
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
    for (let slot = 0; slot < expectedRows * sheet.columns; slot++) {
      const x = (slot % sheet.columns) * CELL.w
      const y = Math.floor(slot / sheet.columns) * CELL.h
      let occupied = false
      for (let cy = 0; cy < CELL.h && !occupied; cy++) {
        for (let cx = 0; cx < CELL.w; cx++) {
          if (pixels[((y + cy) * image.width + x + cx) * 4 + 3] > 0) {
            occupied = true
            break
          }
        }
      }
      if (occupied !== (slot < sheet.count)) throw new Error(`${imageName}: unexpected filled cell ${slot + 1}`)
      if (!occupied) continue

      const frameName = `${SLUG}-${sheet.name}-${String(slot + 1).padStart(3, '0')}.png`
      frames[frameName] = {
        frame: { x, y, w: CELL.w, h: CELL.h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: CELL.w, h: CELL.h },
        sourceSize: { ...CELL },
      }
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
    extent: { x: 1 / 244, y: 16 / 252, w: 197 / 244, h: 230 / 252 },
    sourceSize: { ...CELL },
    canvasSize: { ...CELL },
    sheets: 4,
    clips: {
      idle: clipEntry(SHEETS[0]),
      attack: clipEntry(SHEETS[1]),
      death: clipEntry(SHEETS[3]),
    },
    cast: { special: clipEntry(SHEETS[2]) },
    avatar: 'idle-first-frame (supplied standing reference has opaque black background)',
    avatarSize: { ...CELL },
    avatars: {}, portraits: {}, closeups: {}, radars: {},
  }
  emitJson(manifestPath, manifest)
  process.stdout.write(`${CHECK ? 'Verified' : 'Indexed'} ${SLUG}: 33 idle, 17 attack, 17 special, 17 death frames\n`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
