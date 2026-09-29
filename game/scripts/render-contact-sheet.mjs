// Contact-sheet renderer for impact-marker authoring (impact-sync Phase 8).
// Draws every frame of one packed clip into a labeled grid so the connect
// frame can be picked by EYE - never guessed. Output cell labels carry the
// CLIP-LOCAL frame index (0..frameCount-1), which is what
// art/animation-impact-markers.json stores.
//
// Usage: node scripts/render-contact-sheet.mjs <character|enemy> <slug> <clip> [outPng]
import { createCanvas, loadImage } from 'canvas'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const [, , kind, slug, clipName, outArg] = process.argv
if (!kind || !slug || !clipName) {
  throw new Error('usage: render-contact-sheet.mjs <character|enemy> <slug> <clip> [outPng]')
}

const ROOT = kind === 'character' ? 'public/assets/characters/animated' : 'public/assets/enemies/animated'
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'))
const variant = manifest.variants[slug]
if (!variant) throw new Error(`unknown variant ${slug}`)

// Cast clips report under `cast` keyed by the BARE key ('linh_bao'), while
// markers use the source clip name ('cast-linh_bao') - accept both.
const entry = variant.clips[clipName] ?? variant.cast?.[clipName.replace(/^cast-/, '')]
if (!entry) throw new Error(`unknown clip ${clipName} on ${slug}`)

const atlas = JSON.parse(readFileSync(path.join(ROOT, slug, entry.atlas), 'utf8'))
const sheet = await loadImage(path.join(ROOT, slug, entry.sheet))

// Frames are named <framePrefix><zeroPadded index>.png inside the atlas.
const frames = []
for (let i = entry.firstFrame; i <= entry.lastFrame; i++) {
  const name = `${entry.framePrefix}${String(i).padStart(3, '0')}.png`
  const f = atlas.frames[name]?.frame
  if (!f) throw new Error(`atlas missing ${name}`)
  frames.push({ local: i - entry.firstFrame, ...f })
}

const COLS = Math.min(8, frames.length)
const CELL = 220
const LABEL = 22
const ROWS = Math.ceil(frames.length / COLS)

const canvas = createCanvas(COLS * CELL, ROWS * (CELL + LABEL))
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#1a1a1e'
ctx.fillRect(0, 0, canvas.width, canvas.height)

frames.forEach((f, i) => {
  const cx = (i % COLS) * CELL
  const cy = Math.floor(i / COLS) * (CELL + LABEL)
  const scale = Math.min(CELL / f.w, CELL / f.h)
  const dw = f.w * scale
  const dh = f.h * scale
  ctx.drawImage(sheet, f.x, f.y, f.w, f.h, cx + (CELL - dw) / 2, cy + (CELL - dh) / 2, dw, dh)
  ctx.fillStyle = '#ffd75f'
  ctx.font = 'bold 16px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`#${f.local}`, cx + CELL / 2, cy + CELL + LABEL - 5)
  ctx.strokeStyle = '#333'
  ctx.strokeRect(cx + 0.5, cy + 0.5, CELL, CELL)
})

const out = outArg ?? `art/contact-sheets/${slug}-${clipName}.png`
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, canvas.toBuffer('image/png'))
console.log(`${out}: ${frames.length} frames, ${COLS}x${ROWS}`)
